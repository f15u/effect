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

export const checkout = async (amount: number): Promise<string> => {
  const charge = await liveGateway.charge(amount)
  return `paid ${charge.id}`
}
