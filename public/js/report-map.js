// report-map.js

console.log("Script report-map.js carregado com sucesso!");

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
  libraries: ["marker"],
  mapIds: ["3f69809de9860f5f"]
});

// Função que inicializa o mapa de relatórios após a seção 'map' ser carregada
async function initializeReportMap() {
  try {
    // Encontrar o elemento da seção que contém o mapa
    const mapSection = document.getElementById("map");
    if (!mapSection) {
      console.error("Não foi possível encontrar a seção #map no DOM.");
      return;
    }

    // Localiza o wrapper onde o mapa deve ser inserido
    const mapContainerWrapper = mapSection.querySelector(".map-container");
    if (!mapContainerWrapper) {
      console.error("Não foi possível encontrar o elemento .map-container dentro de #map.");
      return;
    }

    // Limpa o conteúdo atual (ícone e texto de placeholder) e cria um div para o Google Map
    mapContainerWrapper.innerHTML = "";
    const mapDiv = document.createElement("div");
    mapDiv.id = "reportsMap";
    mapDiv.style.width = "100%";
    mapDiv.style.height = "500px";
    mapContainerWrapper.appendChild(mapDiv);

    // Carrega as bibliotecas do Google Maps
    const { Map } = await google.maps.importLibrary("maps");
    const { Marker } = await google.maps.importLibrary("marker");

    // Cria o mapa, centralizado numa posição padrão (Praia Grande)
    const defaultCenter = { lat: -24.0058, lng: -46.4028 };
    const map = new Map(mapDiv, {
      center: defaultCenter,
      zoom: 13,
      mapId: "3f69809de9860f5f",
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        mapTypeIds: ["roadmap", "satellite"]
      }
    });

    // Inicializa Firestore (supondo que o SDK do Firebase já esteja carregado)
    const db = firebase.firestore();

    // Busca todos os relatórios no Firestore
    const snapshot = await db.collection("reportes").get();

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Verifica se possui localização válida
      if (!data.localizacao || !data.localizacao.latitude || !data.localizacao.longitude) {
        console.warn(`Documento ${doc.id} não possui localização válida. Ignorando.`);
        return;
      }

      const position = {
        lat: data.localizacao.latitude,
        lng: data.localizacao.longitude
      };

      // Define ícone de acordo com o status do relatório
      const iconUrl = (data.status && data.status.toLowerCase() === "resolvido")
        ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
        : "http://maps.google.com/mapfiles/ms/icons/red-dot.png";

      // Cria o marcador avançado
            const marker = new Marker({
        map: map,
        position: position,
        title: data.tipo || "Relatório",
        icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(32, 32)
        }
        });


      // Formata a data para pt-BR
      let formattedDate = "";
      if (data.data && data.data.toDate) {
        formattedDate = data.data.toDate().toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      // Monta o conteúdo do InfoWindow
      const infoContent = document.createElement("div");
      infoContent.style.maxWidth = "250px";

      const titleEl = document.createElement("h5");
      titleEl.textContent = data.tipo || "Sem Tipo";
      titleEl.style.marginBottom = "8px";
      infoContent.appendChild(titleEl);

      if (data.endereco) {
        const addressEl = document.createElement("p");
        addressEl.innerHTML = `<strong>Endereço:</strong> ${data.endereco}`;
        addressEl.style.margin = "2px 0";
        infoContent.appendChild(addressEl);
      }

      if (data.descricao) {
        const descEl = document.createElement("p");
        descEl.innerHTML = `<strong>Descrição:</strong> ${data.descricao}`;
        descEl.style.margin = "2px 0";
        infoContent.appendChild(descEl);
      }

      if (data.status) {
        const statusEl = document.createElement("p");
        statusEl.innerHTML = `<strong>Status:</strong> ${data.status}`;
        statusEl.style.margin = "2px 0";
        infoContent.appendChild(statusEl);
      }

      if (formattedDate) {
        const dateEl = document.createElement("p");
        dateEl.innerHTML = `<strong>Enviado em:</strong> ${formattedDate}`;
        dateEl.style.margin = "2px 0";
        infoContent.appendChild(dateEl);
      }

      if (data.foto) {
        const photoEl = document.createElement("div");
        photoEl.style.marginTop = "8px";
        const imgThumb = document.createElement("img");
        imgThumb.src = data.foto;
        imgThumb.alt = "Foto do problema";
        imgThumb.style.width = "100%";
        imgThumb.style.height = "auto";
        imgThumb.style.borderRadius = "4px";
        imgThumb.style.cursor = "pointer";
        imgThumb.addEventListener("click", () => {
          window.open(data.foto, "_blank");
        });
        photoEl.appendChild(imgThumb);
        infoContent.appendChild(photoEl);
      }

      // Cria InfoWindow e associa ao clique no marcador
      const infoWindow = new google.maps.InfoWindow({
        content: infoContent
      });

      marker.addListener("click", () => {
        infoWindow.open({
          anchor: marker,
          map,
          shouldFocus: false
        });
      });
    });
  } catch (error) {
    console.error("Erro ao inicializar o mapa de relatórios:", error);
  }
}

// Aguarda o evento 'sectionLoaded' para a seção 'map'
document.addEventListener("sectionLoaded", (e) => {
  if (e.detail.sectionName === "map") {
    initializeReportMap();
  }
});