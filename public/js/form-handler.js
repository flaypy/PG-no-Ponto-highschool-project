// form-handler.js

console.log("Script form-handler.js carregado com sucesso!");

// Carrega a API do Google Maps
((g) => {
  var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
  b = b[c] || (b[c] = {});
  var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams;
  var u = () => h || (h = new Promise(async (f, n) => {
    await (a = m.createElement("script"));
    e.set("libraries", [...r] + "");
    for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]);
    e.set("callback", c + ".maps." + q);
    a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
    d[q] = f;
    a.onerror = () => h = n(Error(p + " could not load."));
    a.nonce = m.querySelector("script[nonce]")?.nonce || "";
    m.head.append(a);
  }));
  d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => (r.add(f), u().then(() => d[l](f, ...n)));
})({
  key: "AIzaSyDyrb2YQVuLyFNlbZHNVBflsPDN6ueYkS0",
  v: "beta",
  libraries: ["places", "marker"],
  mapIds: ["3f69809de9860f5f"]
});

// Função que inicializa todo o mapa e Firebase após reports.html ser carregado
async function initializeMapAndForm() {
  try {
    // Carrega as bibliotecas do Google Maps
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const { PlaceAutocomplete } = await google.maps.importLibrary("places");
    const { Geocoder } = await google.maps.importLibrary("geocoding");

    // Substitui o <gmpx-place-autocomplete> por um input tradicional
    const autocompleteContainer = document.querySelector('gmpx-place-autocomplete');
    if (!autocompleteContainer) {
      console.error("Elemento <gmpx-place-autocomplete> não encontrado.");
      return;
    }
    const addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.id = 'addressInput';
    addressInput.className = 'form-control';
    addressInput.placeholder = 'Digite o endereço';
    addressInput.required = true;
    autocompleteContainer.replaceWith(addressInput);

    // Elementos do DOM para mapa e localização
    const mapElement = document.getElementById("map-report");
    const locationButton = document.getElementById("locationButton");

    // Posição padrão (Praia Grande)
    const defaultPosition = { lat: -24.0058, lng: -46.4028 };

    // Inicializa o mapa
    const map = new Map(mapElement, {
      center: defaultPosition,
      zoom: 15,
      mapId: "3f69809de9860f5f",
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        mapTypeIds: ["roadmap", "satellite"]
      }
    });

    // Cria um marcador arrastável
    const marker = new AdvancedMarkerElement({
      map: map,
      position: defaultPosition,
      title: "Local do Problema",
      draggable: true
    });

    // Inicializa o autocomplete tradicional para addressInput
    const autocomplete = new google.maps.places.Autocomplete(addressInput, {
      fields: ["formatted_address", "geometry"],
      componentRestrictions: { country: "br" }
    });

    // Função para atualizar o endereço baseado na posição do marcador
    const updateAddressFromPosition = async (position) => {
      const geocoder = new Geocoder();
      geocoder.geocode({ location: position }, (results, status) => {
        if (status === 'OK' && results[0]) {
          addressInput.value = results[0].formatted_address;
        }
      });
    };

    // Atualiza o endereço quando o marcador é arrastado
    marker.addListener('dragend', async () => {
      await updateAddressFromPosition(marker.position);
    });

    // Quando um lugar é selecionado no autocomplete, atualiza mapa e marcador
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        map.setCenter(place.geometry.location);
        marker.position = place.geometry.location;
      }
    });

    // Botão de localização: centraliza no local atual do usuário
    locationButton.addEventListener("click", async () => {
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          map.setCenter(pos);
          marker.position = pos;
          await updateAddressFromPosition(pos);
        } catch (error) {
          console.error("Erro na geolocalização:", error);
          alert("Erro ao obter localização. Verifique as permissões do navegador.");
        }
      } else {
        alert("Seu navegador não suporta geolocalização.");
      }
    });

    // Clicar no mapa move o marcador
    map.addListener('click', async (e) => {
      marker.position = e.latLng;
      await updateAddressFromPosition(e.latLng);
    });

    // Inicializa o campo de endereço com a posição padrão
    await updateAddressFromPosition(defaultPosition);

    // =============================================
    // INTEGRAÇÃO COM FIREBASE
    // =============================================

    const db = firebase.firestore();
    const storage = firebase.storage();

    // Função para upload de imagem ao Firebase Storage
    const uploadImage = async (file) => {
      const storageRef = storage.ref();
      const fileRef = storageRef.child(`reportes/${Date.now()}_${file.name}`);
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'anonymous',
          originalFilename: file.name
        }
      };
      await fileRef.put(file, metadata);
      return await fileRef.getDownloadURL();
    };

    // Handler de envio do formulário
    document.getElementById('reportForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validação do tipo de problema
      const problemTypeSelect = document.getElementById('problemType');
      if (problemTypeSelect.selectedIndex === 0) {
        alert('Por favor, selecione um tipo de problema válido');
        problemTypeSelect.focus();
        return;
      }

      // Exibe indicador de loading no botão de enviar
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      submitBtn.disabled = true;

      try {
        // Validações iniciais
        const photoFile = document.getElementById('problemPhoto').files[0];
        if (!photoFile) {
          throw new Error('Por favor, selecione uma foto do problema');
        }
        if (!firebase.auth().currentUser) {
          throw new Error('Por favor, faça login para enviar reportes');
        }

        // Coleta dados do formulário
        const problemType = document.getElementById('problemType').value;
        const description = document.getElementById('problemDescription').value;

        // Verifica se o marcador foi posicionado
        if (!marker.position) {
          throw new Error('Por favor, selecione uma localização no mapa');
        }
        const location = {
          lat: marker.position.lat,
          lng: marker.position.lng,
          address: addressInput.value || 'Endereço não especificado'
        };

        // Faz upload da imagem
        console.log('Iniciando upload da imagem...');
        const photoURL = await uploadImage(photoFile);
        console.log('Imagem enviada:', photoURL);

        // Prepara dados para Firestore
        console.log('Preparando dados para Firestore...');
        const reportData = {
          tipo: problemType,
          descricao: description,
          localizacao: new firebase.firestore.GeoPoint(location.lat, location.lng),
          endereco: location.address,
          foto: photoURL,
          status: 'pendente',
          data: firebase.firestore.FieldValue.serverTimestamp(),
          userId: firebase.auth().currentUser.uid
        };

        console.log('Enviando para Firestore...', reportData);
        await db.collection('reportes').add(reportData);
        console.log('Reporte enviado com sucesso!');

        // Feedback visual de sucesso
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Enviado com sucesso!';
        setTimeout(() => {
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
        }, 2000);

        // Reseta formulário e mapa
        document.getElementById('reportForm').reset();
        map.setCenter(defaultPosition);
        marker.position = defaultPosition;
        addressInput.value = '';
      } catch (error) {
        console.error('Erro detalhado:', error);
        submitBtn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Erro: ${error.message}`;
        setTimeout(() => {
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
        }, 3000);
      }
    });

  } catch (error) {
    console.error("Erro ao inicializar mapa e formulário:", error);
  }
}

// Aguarda até que a seção 'reports' seja carregada para então executar initializeMapAndForm
document.addEventListener('sectionLoaded', (e) => {
  if (e.detail.sectionName === 'reports') {
    initializeMapAndForm();
  }
});
