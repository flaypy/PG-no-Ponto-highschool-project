document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
      const authStatus = document.getElementById('authStatus');
      const loginLink = document.getElementById('loginLink');
      const registerLink = document.getElementById('registerLink');
      const logoutLink = document.getElementById('logoutLink');
      const accountLink = document.getElementById('accountLink');
  
      if (user) {
        authStatus.textContent = user.displayName || "Minha Conta";
        loginLink.classList.add('d-none');
        registerLink.classList.add('d-none');
        logoutLink.classList.remove('d-none');
        accountLink.classList.remove('d-none');
      } else {
        authStatus.textContent = "Entrar";
        loginLink.classList.remove('d-none');
        registerLink.classList.remove('d-none');
        logoutLink.classList.add('d-none');
        accountLink.classList.add('d-none');
      }
    });
  
    document.getElementById('logoutLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      firebase.auth().signOut().then(() => {
        window.location.href = "/";
      });
    });
  });
  