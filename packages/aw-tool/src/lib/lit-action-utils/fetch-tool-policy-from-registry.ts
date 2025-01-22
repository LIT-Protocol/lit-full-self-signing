export const fetchToolPolicyFromRegistry = async (
  pkpToolRegistryContract: any,
  pkpTokenId: string,
  delegateeAddress: string,
  toolIpfsCid: string
) => {
  console.log(
    `Fetching tool policy from PKP Tool Registry: ${pkpToolRegistryContract.address}...`,
    `PKP Token ID: ${pkpTokenId}`,
    `Delegatee Address: ${delegateeAddress}`,
    `Tool IPFS CID: ${toolIpfsCid}`
  );

  const toolPolicy = (
    await pkpToolRegistryContract.getToolPoliciesForDelegatees(
      pkpTokenId,
      [toolIpfsCid],
      [delegateeAddress]
    )
  )[0];

  console.log(`Tool Policy: ${toolPolicy}`);
  return toolPolicy;
};
