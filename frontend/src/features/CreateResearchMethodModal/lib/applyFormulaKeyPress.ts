/** Вставка символа или backspace в input с восстановлением позиции каретки. */
export function applyFormulaKeyPress(
  input: HTMLInputElement,
  value: string,
  onUpdate: (newValue: string) => void
): void {
  const start = input.selectionStart || 0;
  const end = input.selectionEnd || 0;

  if (value === 'backspace') {
    if (start !== end) {
      const newValue = input.value.substring(0, start) + input.value.substring(end);
      onUpdate(newValue);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start;
        input.focus();
      }, 0);
    } else if (start > 0) {
      const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
      onUpdate(newValue);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start - 1;
        input.focus();
      }, 0);
    }
  } else {
    const newValue = input.value.substring(0, start) + value + input.value.substring(end);
    onUpdate(newValue);
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + value.length;
      input.focus();
    }, 0);
  }
}
