import { randomBytes } from "node:crypto";

/**
 * Interface de gateway de pagamento. O MVP usa o MockGateway, que gera um link interno (/pagar/[token])
 * simulando PIX e cartão. Para produção, implemente Stripe, Mercado Pago, Asaas, PagSeguro etc. seguindo esta interface.
 */
export interface PaymentGateway {
  name: string;
  createPaymentLink(input: { amountCents: number; description: string; maxInstallments: number }): Promise<{
    token: string;
    url: string;
    reference: string;
  }>;
  refund(reference: string): Promise<{ ok: boolean }>;
}

export const mockGateway: PaymentGateway = {
  name: "simulado",
  async createPaymentLink() {
    const token = randomBytes(12).toString("base64url");
    return { token, url: `/pagar/${token}`, reference: `SIM-${token.slice(0, 8).toUpperCase()}` };
  },
  async refund() {
    return { ok: true };
  },
};

export function getGateway(): PaymentGateway {
  return mockGateway;
}

/** Código "copia e cola" PIX ilustrativo (não é um BR Code válido). */
export function fakePixCode(token: string, amountCents: number) {
  return `00020126580014BR.GOV.BCB.PIX0136consultaviva-${token}520400005303986540${(amountCents / 100).toFixed(2)}5802BR6009SAO PAULO62070503***6304SIMU`;
}
