// Validacao do plano antes de liberar o JOGAR.
// Fase 5: este arquivo vai perguntar ao servidor Django se o plano esta ativo
// e se nao ha outra sessao aberta na mesma conta. Por enquanto, sempre libera.

export async function validarLicenca() {
  return { ok: true, mensagem: '' };
}
