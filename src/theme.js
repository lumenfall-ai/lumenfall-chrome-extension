function applyTheme(preference) {
  if (preference === "auto" || !preference) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", preference);
  }
}

function initTheme() {
  chrome.storage.sync.get({ theme: "auto" }, (settings) => {
    applyTheme(settings.theme);
  });
}

initTheme();
