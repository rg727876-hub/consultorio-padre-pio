const axios = require('axios');

const consultarDni = async (dni) => {
  const token = process.env.DECOLECTA_TOKEN;
  if (!token) {
    throw new Error('DECOLECTA_TOKEN no está configurado en el servidor');
  }

  try {
    const response = await axios.get(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      timeout: 10000 // 10s timeout
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 400 || error.response.status === 404) {
        throw new Error('DNI no encontrado o inválido');
      }
      throw new Error(`Error de Decolecta: ${error.response.statusText}`);
    }
    throw new Error('Error de conexión con el servicio de validación de DNI');
  }
};

module.exports = {
  consultarDni
};
