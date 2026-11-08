import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Nft, NftListParams, Paginated } from '@/types/contracts'

export const useNfts = (params: NftListParams) =>
  useQuery({
    queryKey: ['nfts', params], // a chave reflete exatamente os parâmetros enviados
    queryFn: async ({ signal }) => (await api.get<Paginated<Nft>>('/nfts', { params, signal })).data, // signal descarta respostas obsoletas
    placeholderData: keepPreviousData,
  })

export const useNft = (id: string) =>
  useQuery({
    queryKey: ['nft', id],
    queryFn: async ({ signal }) => (await api.get<Nft>(`/nfts/${id}`, { signal })).data,
    retry: false,
  })

export const useSetCartQuantity = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { nftId: string; quantity: number }) =>
      (await api.put(`/cart/items/${v.nftId}`, { quantity: v.quantity })).data,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['cart'] })
      qc.invalidateQueries({ queryKey: ['quote'] })
    },
  })
}
