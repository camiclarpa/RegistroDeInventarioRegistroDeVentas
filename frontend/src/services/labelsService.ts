import axios from 'axios';

const API_URL = '/api/labels';

/**
 * ✅ SOLO LECTURA - Obtener productos para etiquetas
 */
export const getProductsForLabels = async () => {
  const response = await axios.get(`${API_URL}/products`);
  return response.data;
};

/**
 * ✅ SOLO LECTURA - Obtener un producto específico
 */
export const getProductForLabel = async (id: string) => {
  const response = await axios.get(`${API_URL}/products/${id}`);
  return response.data;
};

/**
 * ✅ Generar código de barras
 */
export const generateBarcodeImage = async (type: string, text: string) => {
  const response = await axios.post(
    `${API_URL}/generate-barcode`,
    { type, text },
    { responseType: 'blob' }
  );
  return URL.createObjectURL(response.data);
};
