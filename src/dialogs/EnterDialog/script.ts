/// <reference lib="dom" />

const cmdInput = document.getElementById('cmd') as HTMLInputElement;

function submit(): void {
  const cmd = cmdInput.value.trim();
  if (!cmd) {
    return;
  }
  google.script.run
    .withSuccessHandler(() => {
      google.script.host.close();
    })
    .withFailureHandler((err: Error) => {
      // eslint-disable-next-line no-alert -- Native alert is the standard error feedback in Apps Script HTML dialogs.
      alert(err.message);
    })
    .submitEnterCommand(cmd);
}

cmdInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    submit();
    e.preventDefault();
  }
  if (e.key === 'Escape') {
    google.script.host.close();
  }
});

document.getElementById('cancelBtn')?.addEventListener('click', () => {
  google.script.host.close();
});

document.getElementById('okBtn')?.addEventListener('click', () => {
  submit();
});
