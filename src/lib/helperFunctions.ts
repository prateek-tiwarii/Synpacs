export const formatDate = (date: string, includeTime: boolean = false): string => {
  if (!date) return "N/A";
  
  if (/^\d{8}$/.test(date)) {
    const year = parseInt(date.substring(0, 4), 10);
    const month = parseInt(date.substring(4, 6), 10) - 1;
    const day = parseInt(date.substring(6, 8), 10);
    const dateObj = new Date(year, month, day);
    if (includeTime) {
      return `${dateObj.toLocaleDateString()}\n${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return dateObj.toLocaleDateString();
  }
  
  try {
    const dateObj = new Date(date);
    if (includeTime) {
      return `${dateObj.toLocaleDateString()}\n${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return dateObj.toLocaleDateString();
  } catch {
    return date;
  } 
}

export const formatTime = (time: string): string => {
  if (!time) return "N/A";
  
  // Handle DICOM time format: HHMMSS or HHMMSS.ffffff (6 digits optionally followed by fractional seconds)
  if (/^\d{6}(\.\d+)?$/.test(time)) {
    // Extract just the HHMMSS part (first 6 digits), ignoring fractional seconds
    const timeStr = time.substring(0, 6);
    const hours = parseInt(timeStr.substring(0, 2), 10);
    const minutes = parseInt(timeStr.substring(2, 4), 10);
    const seconds = parseInt(timeStr.substring(4, 6), 10);
    
    // Validate the time values
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60) {
      const timeObj = new Date(1970, 0, 1, hours, minutes, seconds);
      return timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  
  // Try to parse as ISO time string (HH:MM:SS or HH:MM:SS.fff)
  try {
    // If it already contains colons, try parsing directly
    if (time.includes(':')) {
      const timeObj = new Date(`1970-01-01T${time}`);
      if (!isNaN(timeObj.getTime())) {
        return timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }
  } catch {
    // Fall through to return original value
  }
  
  return time;
}