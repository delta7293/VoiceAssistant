interface CallParams {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  fileNumber: string;
  template: string;
}

export const makeCall = async (params: CallParams) => {
  try {
    const response = await fetch('/api/makeCall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error making call:', error);
    throw error;
  }
}; 