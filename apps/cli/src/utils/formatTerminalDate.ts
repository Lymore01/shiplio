export const formatTerminalDate = (dateString: string | null) => {
  if (!dateString) return "N/A";

  try {
    const isoString = dateString.includes('T') 
      ? dateString 
      : dateString.replace(' ', 'T') + 'Z';
      
    const date = new Date(isoString);
    
    if (isNaN(date.getTime())) return "Invalid Date";

    return date.toLocaleString();
  } catch (e) {
    return "Error parsing date";
  }
};