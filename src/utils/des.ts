import CryptoJS from 'crypto-js';

const key = 'ciService';
const keyHex = CryptoJS.enc.Utf8.parse(key);

// 加密
export const encryptDES = (message: any) => {
  if (message) {
    let encrypted = CryptoJS.DES.encrypt(message, keyHex, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.ciphertext.toString();
  } else {
    return '';
  }
};
