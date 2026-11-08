export interface Payment {
  readonly amount: number
  readonly token: string
}

export const readPayment = (json: string): Payment | undefined => {
  const value = JSON.parse(json)
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.amount === "number" &&
    typeof value.token === "string"
  ) {
    return { amount: value.amount, token: value.token }
  }
  return undefined
}
