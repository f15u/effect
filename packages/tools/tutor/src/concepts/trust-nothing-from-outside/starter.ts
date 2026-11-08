export interface Payment {
  readonly amount: number
  readonly token: string
}

export const readPayment = (json: string): Payment | undefined => {
  const value = JSON.parse(json)
  return value
}
