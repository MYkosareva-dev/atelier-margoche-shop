import { getPayload as getPayloadInstance } from 'payload'
import config from '@payload-config'

/** Local API client for Server Components. Payload caches the instance across calls. */
export const getPayload = () => getPayloadInstance({ config })
