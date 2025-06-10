// Este script lida com a atualização das estatísticas globais na página inicial.

document.addEventListener('DOMContentLoaded', () => {
    // Aguarda o Firebase ser inicializado pelo script principal
    const firebaseAppCheck = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            clearInterval(firebaseAppCheck);
            initializeGlobalStats();
        }
    }, 100);
});

/**
 * Conecta-se ao Firestore para ouvir as mudanças na coleção 'reportes'
 * e atualizar as estatísticas em tempo real.
 */
function initializeGlobalStats() {
    const db = firebase.firestore();
    const statsContainer = document.getElementById('estatisticas');

    if (!statsContainer) {
        // Se a seção de estatísticas não estiver na página, não faz nada.
        return;
    }

    const reportedEl = statsContainer.querySelector('h3[data-stat="reportados"]');
    const solvedEl = statsContainer.querySelector('h3[data-stat="resolvidos"]');
    const pendingEl = statsContainer.querySelector('h3[data-stat="analise"]');
    const refusedEl = statsContainer.querySelector('h3[data-stat="recusados"]');
    
    if(!reportedEl || !solvedEl || !pendingEl || !refusedEl) {
        console.warn("Elementos de estatística não encontrados na página inicial.");
        return;
    }

    db.collection("reportes").onSnapshot(querySnapshot => {
        let reportedCount = querySnapshot.size;
        let solvedCount = 0;
        let pendingCount = 0;
        let refusedCount = 0;

        querySnapshot.forEach(doc => {
            const status = doc.data().status;
            switch (status) {
                case 'resolvido':
                    solvedCount++;
                    break;
                case 'pendente':
                case 'em andamento':
                    pendingCount++;
                    break;
                case 'recusado':
                    refusedCount++;
                    break;
            }
        });
        
        // Anima a atualização dos números
        animateValue(reportedEl, reportedCount);
        animateValue(solvedEl, solvedCount);
        animateValue(pendingEl, pendingCount);
        animateValue(refusedEl, refusedCount);

    }, error => {
        console.error("Erro ao carregar estatísticas globais: ", error);
        reportedEl.textContent = '-';
        solvedEl.textContent = '-';
        pendingEl.textContent = '-';
        refusedEl.textContent = '-';
    });
}

/**
 * Anima a mudança de um número em um elemento HTML.
 * @param {HTMLElement} element - O elemento a ser animado.
 * @param {number} endValue - O valor final.
 */
function animateValue(element, endValue) {
    let startValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
    if (startValue === endValue) return;
    
    let duration = 1000; // 1 segundo
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const currentValue = Math.floor(progress * (endValue - startValue) + startValue);
        element.textContent = currentValue.toLocaleString('pt-BR');
        if (progress < 1) {
            requestAnimationFrame(animation);
        }
    }
    requestAnimationFrame(animation);
}
