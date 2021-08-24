import BigNumber from "bignumber.js";

export type NFT = {
  // id crafted by live
  id: string;
  // id on chain
  tokenId: BigNumber;
  collection: {
    contract: string;
    name: string;
    // dynamic number of token on the collection's contract
    totalSupply: BigNumber | null;
    contractSpec: "ERC721" | "ERC1155";
  };
};
