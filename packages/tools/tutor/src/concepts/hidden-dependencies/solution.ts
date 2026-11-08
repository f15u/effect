export interface Charge {
  readonly id: string
  readonly amount: number
}

export interface Gateway {
  readonly charge: (amount: number) => Promise<Charge>
}

export const liveGateway: Gateway = {
  charge: async () => {
    throw new Error("real network call")
  }
}

export const checkout = async (
  amount: number,
  gateway: Gateway
): Promise<string> => {
  const charge = await gateway.charge(amount)
  return `paid ${charge.id}`
}
