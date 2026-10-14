export type OmqrisPgMode = "public" | "pribadi";

export type OmqrisTransactionPayloadInput = {
  amount: number;
  item: string;
  merchantRef: string;
  webhookUrl: string;
  pgMode: OmqrisPgMode;
};

export function buildOmqrisTransactionPayload(input: OmqrisTransactionPayloadInput) {
  return {
    amount: input.amount,
    item: input.item,
    merchant_ref: input.merchantRef,
    webhook_url: input.webhookUrl,
    pg_mode: input.pgMode
  };
}
