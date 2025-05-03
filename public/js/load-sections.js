document.addEventListener('DOMContentLoaded', () => {
    const sections = [
      "nav",
      "hero",
      "how",
      "common",
      "map",
      "stats",
      "reports",
      "about",
      "faq",
      "footer",
      "button"
    ];
  
    sections.forEach(section => {
      fetch(`sections/${section}.html`)
        .then(resp => {
          if (!resp.ok) throw new Error(`Erro ao carregar ${section}: ${resp.statusText}`);
          return resp.text();
        })
        .then(html => {
          const container = document.getElementById(section);
          if (container) container.innerHTML = html;
        })
        .catch(err => console.error(err));
    });
  });