import Holidays from 'date-holidays';

const hd = new Holidays('BR');

export function isFeriado(dateInput: string | Date): { isFeriado: boolean; nome?: string } {
  const date = typeof dateInput === "string" ? new Date(`${dateInput}T12:00:00`) : dateInput;
  if (isNaN(date.getTime())) return { isFeriado: false };
  
  const holidays = hd.isHoliday(date);
  if (holidays && holidays.length > 0) {
    // Filtra apenas feriados PÚBLICOS oficiais
    // Ignora: 'observance' (Namorados, Dia dos Pais), 'optional' (Quarta de Cinzas)
    const feriadoPublico = holidays.find((h: any) => h.type === 'public');
    if (feriadoPublico) {
      return { isFeriado: true, nome: feriadoPublico.name };
    }
  }
  
  return { isFeriado: false };
}
