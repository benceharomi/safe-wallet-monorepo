import { GATEWAY_URL_PRODUCTION } from '@/config/constants'
import { localItem } from '@/services/local-storage/local'

export const LS_KEY = 'debugProdCgw'
export const cgwDebugStorage = localItem<boolean>(LS_KEY)
export const GATEWAY_URL = GATEWAY_URL_PRODUCTION
