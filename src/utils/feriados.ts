import Holidays from 'date-holidays';

const hd = new Holidays('BR');

export function isFeriado(dateInput: string | Date): { isFeriado: boolean; nome?: string } {
  const date = typeof dateInput === "string" ? new Date(`${dateInput}T12:00:00`) : dateInput;
  if (isNaN(date.getTime())) return { isFeriado: false };
  
  const holidays = hd.isHoliday(date);
  if (holidays && holidays.length > 0) {
    // Retorna o nome do primeiro feriado público ou principal
    return { isFeriado: true, nome: holidays[0].name };
  }
  
  return { isFeriado: false };
}
