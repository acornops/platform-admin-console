export function createToastController(toast) {
  const message = toast.querySelector("#toast-message");
  const close = toast.querySelector("#toast-close");
  let timeoutId;

  const hide = () => {
    window.clearTimeout(timeoutId);
    toast.classList.remove("visible");
  };

  close.addEventListener("click", hide);
  return (text, tone = "success") => {
    window.clearTimeout(timeoutId);
    toast.classList.remove("visible");
    message.textContent = text;
    toast.dataset.tone = tone;
    void toast.offsetWidth;
    toast.classList.add("visible");
    timeoutId = window.setTimeout(hide, 3800);
  };
}
