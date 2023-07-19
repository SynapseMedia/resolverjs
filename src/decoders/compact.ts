import * as jose from 'jose'
import type { IPFS } from 'ipfs-core-types'
import { CID } from 'multiformats'

/**
 * Creates a Compact decoder .
 *
 * @param node - The connected ipfs node to use for metadata retrieval.
 * @return A Compact decoder.
 */
export const createCompact = (node: IPFS): Decoder => {
  /**
   * Resolves the metadata from cid using IPFS node `block` api.
   *
   * @param cid - The metadata cid to resolve.
   * @return  The raw metadata resolved from cid.
   */
  const fetch = async (cid: CID): Promise<string> => {
    const token = await node.block.get(cid)
    return token.toString()
  }

  /**
   * Deserializes the resolved data from IPFS CID according to the specification in SEP-001
   * @see {@link https://github.com/SynapseMedia/sep/blob/main/SEP/SEP-001.md SEP-001} for the specification.
   *
   * @param cid - The raw metadata cid to deserialize.
   * @returns A promise that resolves with SEP001 representation.
   */
  return async (cid: CID): Promise<SEP001> => {
    const rawMetadata = await fetch(cid)
    const verifiedMetadata = await jose.compactVerify(rawMetadata, jose.EmbeddedJWK)

    // Decode Uint8Array to JSON object
    const stringPayload = (new TextDecoder().decode(verifiedMetadata.payload))
    const rawPayload = JSON.parse(stringPayload)
    const claims = [rawPayload?.s, rawPayload?.d, rawPayload?.t]

    // We need to be sure that every nested claims CID exists in payload.
    if (!claims.every((c) => c !== undefined)) {
      throw new Error('Invalid standard payload. The claims s, t and d are not present in payload.')
    }

    const s = JSON.parse(await fetch(CID.parse(rawPayload.s)))
    const d = JSON.parse(await fetch(CID.parse(rawPayload.d)))
    const t = JSON.parse(await fetch(CID.parse(rawPayload.t)))

    const payload: Payload = { s, d, t }
    const header: Header = verifiedMetadata.protectedHeader as Header

    return {
      header,
      payload
    }
  }
}
