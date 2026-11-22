// Fotos de perfil de quem esta correndo. Cada foto e baixada uma vez so e fica
// guardada para os nomes na pista. Se a foto nao carregar, aparece a inicial.

const LIMITE = 300; // fotos guardadas ao mesmo tempo (as mais antigas saem)

export function criarFotos() {
  const guardadas = new Map(); // url -> { img, estado: 'carregando' | 'ok' | 'erro' }

  /** Devolve a imagem pronta para desenhar, ou null se ainda nao carregou (ou falhou). */
  function obter(url) {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return null;

    let item = guardadas.get(url);
    if (!item) {
      const img = new Image();
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      item = { img, estado: 'carregando' };
      img.onload = () => {
        item.estado = img.naturalWidth > 0 ? 'ok' : 'erro';
      };
      img.onerror = () => {
        item.estado = 'erro';
      };
      img.src = url;
      guardadas.set(url, item);
      if (guardadas.size > LIMITE) guardadas.delete(guardadas.keys().next().value);
    }
    return item.estado === 'ok' ? item.img : null;
  }

  return { obter };
}
