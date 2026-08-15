/** Shared application-to-contract boundary used by the Bradbury frontend. */
export async function readShipment(client: any, address: `0x${string}`, shipmentId: string) {
  return client.readContract({ address, functionName: "get_shipment", args: [shipmentId.trim().toLowerCase()] });
}

export async function listShipmentIds(client: any, address: `0x${string}`) {
  return client.readContract({ address, functionName: "list_shipments", args: [] });
}

export async function sendShipmentAction(
  client: any,
  address: `0x${string}`,
  functionName: string,
  args: any[],
  value: bigint,
) {
  return client.writeContract({ address, functionName, args, value });
}
