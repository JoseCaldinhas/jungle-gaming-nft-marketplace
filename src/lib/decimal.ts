import Decimal from 'decimal.js'
import type { EthString } from '@/types/contracts'

Decimal.set({ precision: 40 })

export const eth = (v: EthString | number) => new Decimal(v)
export const addEth = (a: EthString, b: EthString): EthString => eth(a).plus(b).toFixed()
export const mulEth = (a: EthString, qty: number): EthString => eth(a).times(qty).toFixed()
export const formatEth = (v: EthString) => `${eth(v).toDecimalPlaces(6).toFixed()} ETH`
