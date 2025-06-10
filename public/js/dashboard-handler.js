// Espera o DOM e o Firebase estarem prontos
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // Se o usuário está logado, inicializa o dashboard
            initializeDashboard(user);
        } else {
            // Se não, redireciona para a página de login
            window.location.href = '/login.html';
        }
    });
});

let userUnsubscribe = null;
let reportsUnsubscribe = null;

/**
 * Inicializa todas as funcionalidades do dashboard.
 * @param {object} user - O objeto do usuário autenticado do Firebase.
 */
function initializeDashboard(user) {
    const userId = user.uid;

    // Configura os ouvintes de eventos (listeners) da UI
    setupUIListeners();

    // Carrega e monitora os dados do usuário em tempo real
    listenToUserData(userId);

    // Carrega e monitora os reportes do usuário em tempo real
    listenToUserReports(userId);
    
    // Mostra a primeira seção
    navigateToSection('dashboard-home');
}

/**
 * Configura todos os listeners de eventos da interface do usuário.
 */
function setupUIListeners() {
    // Listener para o botão de logout
    document.getElementById('logoutButton').addEventListener('click', (e) => {
        e.preventDefault();
        // Desconecta os listeners do Firestore antes de sair
        if (userUnsubscribe) userUnsubscribe();
        if (reportsUnsubscribe) reportsUnsubscribe();
        firebase.auth().signOut();
    });

    // Listener para o botão de toggle da sidebar em mobile
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });
    
    // Listeners para os links de navegação da sidebar
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        if(link.dataset.section) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;
                navigateToSection(sectionId);

                // Carrega dados específicos quando a seção é acessada
                if(sectionId === 'meus-reportes') loadAllUserReports(firebase.auth().currentUser.uid);
                if(sectionId === 'premiacao') loadRankingData();
            });
        }
    });
    
     // Listener para o filtro de status na página "Meus Reportes"
    document.getElementById('filterStatus').addEventListener('change', (e) => {
        loadAllUserReports(firebase.auth().currentUser.uid, e.target.value);
    });
}

/**
 * Navega para uma seção específica do dashboard.
 * @param {string} sectionId - O ID da seção a ser exibida.
 */
function navigateToSection(sectionId) {
    // Esconde todas as seções
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.add('d-none');
    });

    // Mostra a seção desejada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('d-none');
    }
    
    // Atualiza o link ativo na sidebar
     document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });
}


/**
 * Ouve as alterações nos dados do usuário em tempo real.
 * @param {string} userId - O ID do usuário.
 */
function listenToUserData(userId) {
    const db = firebase.firestore();
    const userRef = db.collection("usuarios").doc(userId);

    // 'onSnapshot' cria um listener em tempo real
    userUnsubscribe = userRef.onSnapshot(doc => {
        if (doc.exists) {
            const userData = doc.data();
            updateUIAvatar(userData.nome, firebase.auth().currentUser.photoURL);
            updateUIText('userName', userData.nome || 'Usuário');
            updateUIText('welcomeName', userData.nome || 'Usuário');
            updateUIText('userPoints', `${userData.pontos || 0} pontos`);
            updateUIText('pointsDisplay', userData.pontos || 0);
        }
    }, error => {
        console.error("Erro ao ouvir dados do usuário:", error);
    });
}


/**
 * Ouve as alterações nos reportes do usuário em tempo real.
 * @param {string} userId - O ID do usuário.
 */
function listenToUserReports(userId) {
    const db = firebase.firestore();
    const reportsQuery = db.collection("reportes").where("userId", "==", userId);

    reportsUnsubscribe = reportsQuery.onSnapshot(querySnapshot => {
        const reportsData = {
            total: querySnapshot.size,
            solved: 0,
            pending: 0,
            recent: []
        };
        
        const allReports = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        // Ordena por data para pegar os mais recentes
        allReports.sort((a, b) => b.data.toMillis() - a.data.toMillis());

        allReports.forEach(report => {
            if (report.status === 'resolvido') {
                reportsData.solved++;
            } else if (report.status === 'pendente' || report.status === 'em andamento') {
                reportsData.pending++;
            }
        });
        
        reportsData.recent = allReports.slice(0, 5);

        // Atualiza os cards de estatísticas
        updateUIText('totalReports', reportsData.total);
        updateUIText('solvedReports', reportsData.solved);
        updateUIText('pendingReports', reportsData.pending);

        // Atualiza a tabela de reportes recentes
        populateRecentReportsTable(reportsData.recent);

    }, error => {
        console.error("Erro ao ouvir reportes:", error);
    });
}

/**
 * Carrega todos os reportes de um usuário para a página "Meus Reportes".
 * @param {string} userId - O ID do usuário.
 * @param {string} [statusFilter='all'] - O status para filtrar os reportes.
 */
function loadAllUserReports(userId, statusFilter = 'all') {
    const tableBody = document.getElementById('allReportsTableBody');
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center"><div class="spinner-border" role="status"></div> Carregando...</td></tr>`;

    const db = firebase.firestore();
    let query = db.collection("reportes").where("userId", "==", userId).orderBy("data", "desc");
    
    if (statusFilter !== 'all') {
        query = query.where("status", "==", statusFilter);
    }
    
    query.get().then(querySnapshot => {
        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center">Nenhum reporte encontrado para este filtro.</td></tr>`;
            return;
        }

        let reportsHtml = '';
        querySnapshot.forEach(doc => {
            const report = {id: doc.id, ...doc.data()};
            const reportDate = report.data ? report.data.toDate().toLocaleDateString('pt-BR') : 'N/A';
            const shortAddress = report.endereco ? report.endereco.substring(0, 35) + '...' : 'Endereço não informado';
            
            reportsHtml += `
                <tr data-id="${report.id}">
                    <td><img src="${report.foto}" alt="Foto do reporte" class="report-thumb"></td>
                    <td>#${report.id.substring(0, 6)}</td>
                    <td>${report.tipo}</td>
                    <td title="${report.endereco}">${shortAddress}</td>
                    <td><span class="status-badge status-${report.status.replace(' ', '-')}">${report.status}</span></td>
                    <td>${reportDate}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-details-btn" data-id="${report.id}">
                           <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = reportsHtml;
        
        // Adiciona listeners aos botões de "ver detalhes"
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', () => showReportDetails(btn.dataset.id));
        });

    }).catch(error => {
        console.error("Erro ao carregar todos os reportes:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Erro ao carregar reportes.</td></tr>`;
    });
}


/**
 * Carrega e exibe o ranking de usuários por pontos.
 */
function loadRankingData() {
     const tableBody = document.getElementById('rankingTableBody');
    tableBody.innerHTML = `<tr><td colspan="3" class="text-center"><div class="spinner-border" role="status"></div> Carregando ranking...</td></tr>`;
    
    const db = firebase.firestore();
    db.collection("usuarios").orderBy("pontos", "desc").limit(100).get().then(querySnapshot => {
        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center">Nenhum usuário no ranking ainda.</td></tr>`;
            return;
        }
        
        let rankingHtml = '';
        let rank = 1;
        querySnapshot.forEach(doc => {
            const user = doc.data();
            rankingHtml += `
                <tr>
                    <td><span class="rank-badge">${rank}</span></td>
                    <td>${user.nome || 'Usuário Anônimo'}</td>
                    <td>${user.pontos || 0}</td>
                </tr>
            `;
            rank++;
        });
        tableBody.innerHTML = rankingHtml;
        
    }).catch(error => {
        console.error("Erro ao carregar ranking:", error);
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Erro ao carregar o ranking.</td></tr>`;
    });
}


/**
 * Preenche a tabela de reportes recentes na página principal do dashboard.
 * @param {Array} reports - Uma lista de objetos de reporte.
 */
function populateRecentReportsTable(reports) {
    const tableBody = document.getElementById('reportsTableBody');
    if (reports.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center">Você ainda não fez nenhum reporte.</td></tr>`;
        return;
    }

    let reportsHtml = '';
    reports.forEach(report => {
        const reportDate = report.data ? report.data.toDate().toLocaleDateString('pt-BR') : 'N/A';
        reportsHtml += `
            <tr data-id="${report.id}">
                <td>#${report.id.substring(0, 6)}</td>
                <td>${report.tipo}</td>
                <td><span class="status-badge status-${report.status.replace(' ', '-')}">${report.status}</span></td>
                <td>${reportDate}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-details-btn" data-id="${report.id}">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = reportsHtml;
    
    // Adiciona listeners aos botões de "ver detalhes"
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', () => showReportDetails(btn.dataset.id));
    });
}

/**
 * Busca os detalhes de um reporte e exibe em um modal.
 * @param {string} reportId - O ID do reporte a ser visualizado.
 */
function showReportDetails(reportId) {
    const db = firebase.firestore();
    const reportRef = db.collection("reportes").doc(reportId);
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    
    modalTitle.textContent = `Detalhes do Reporte #${reportId.substring(0, 6)}`;
    modalBody.innerHTML = `<div class="text-center"><div class="spinner-border" role="status"></div></div>`;
    
    const reportModal = new bootstrap.Modal(document.getElementById('reportDetailModal'));
    reportModal.show();

    reportRef.get().then(doc => {
        if (doc.exists) {
            const report = doc.data();
            const reportDate = report.data.toDate().toLocaleString('pt-BR');
            
            modalBody.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <img src="${report.foto}" class="img-fluid rounded mb-3" alt="Foto do reporte">
                    </div>
                    <div class="col-md-6">
                        <h5>${report.tipo}</h5>
                        <p><strong>Endereço:</strong> ${report.endereco}</p>
                        <p><strong>Descrição:</strong> ${report.descricao}</p>
                        <p><strong>Status:</strong> <span class="status-badge status-${report.status.replace(' ', '-')}">${report.status}</span></p>
                        <p><strong>Data do Reporte:</strong> ${reportDate}</p>
                    </div>
                </div>
            `;
        } else {
            modalBody.innerHTML = `<p class="text-danger">Reporte não encontrado.</p>`;
        }
    }).catch(error => {
        console.error("Erro ao buscar detalhes do reporte:", error);
        modalBody.innerHTML = `<p class="text-danger">Erro ao carregar detalhes.</p>`;
    });
}


// --- Funções Utilitárias ---

/**
 * Atualiza o conteúdo de texto de um elemento da UI.
 * @param {string} id - O ID do elemento.
 * @param {string} text - O texto a ser inserido.
 */
function updateUIText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Atualiza o avatar do usuário.
 * @param {string} name - O nome do usuário.
 * @param {string} photoURL - A URL da foto do usuário.
 */
function updateUIAvatar(name, photoURL) {
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        if (photoURL) {
            avatar.src = photoURL;
        } else {
            // Gera um avatar com as iniciais se não houver foto
            avatar.src = `https://ui-avatars.com/api/?background=3498db&color=fff&name=${encodeURIComponent(name || '?')}`;
        }
    }
}
