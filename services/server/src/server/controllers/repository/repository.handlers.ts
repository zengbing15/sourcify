import { Response, Request, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import {
  ContractData,
  FilesInfo,
  MatchLevel,
  PaginatedContractData,
} from "../../types";
import { NotFoundError } from "../../../common/errors";
import { Match } from "@ethereum-sourcify/lib-sourcify";
import { services } from "../../services/services";
import logger from "../../../common/logger";

type RetrieveMethod = (
  chain: string,
  address: string,
  match: MatchLevel
) => Promise<FilesInfo<any>>;
type ConractRetrieveMethod = (chain: string) => Promise<ContractData>;
type PaginatedConractRetrieveMethod = (
  chain: string,
  match: MatchLevel,
  page: number,
  limit: number
) => Promise<PaginatedContractData>;

export function createEndpoint(
  retrieveMethod: RetrieveMethod,
  match: MatchLevel,
  reportMatchStatus = false
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let retrieved: FilesInfo<any>;
    try {
      retrieved = await retrieveMethod(
        req.params.chain,
        req.params.address,
        match
      );
      if (retrieved.files.length === 0)
        return next(new NotFoundError("Files have not been found!"));
    } catch (err: any) {
      return next(new NotFoundError(err.message));
    }
    return res
      .status(StatusCodes.OK)
      .json(reportMatchStatus ? retrieved : retrieved.files);
  };
}

export function createContractEndpoint(
  contractRetrieveMethod: ConractRetrieveMethod
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let retrieved: ContractData;
    try {
      retrieved = await contractRetrieveMethod(req.params.chain);
      if (retrieved.full.length === 0 && retrieved.partial.length === 0)
        return next(new NotFoundError("Contracts have not been found!"));
    } catch (err: any) {
      return next(new NotFoundError(err.message));
    }
    return res.status(StatusCodes.OK).json(retrieved);
  };
}

export function createPaginatedContractEndpoint(
  paginatedContractRetrieveMethod: PaginatedConractRetrieveMethod,
  match: MatchLevel
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let retrieved: PaginatedContractData;
    try {
      retrieved = await paginatedContractRetrieveMethod(
        req.params.chain,
        match,
        parseInt((req.query.page as string) || "0"),
        parseInt((req.query.limit as string) || "200")
      );
    } catch (err: any) {
      return next(new NotFoundError(err.message));
    }
    return res.status(StatusCodes.OK).json(retrieved);
  };
}

export async function checkAllByChainAndAddressEndpoint(
  req: any,
  res: Response
) {
  const map: Map<string, any> = new Map();
  const addresses = req.query.addresses.split(",");
  const chainIds = req.query.chainIds.split(",");
  logger.debug("checkAllByChainAndAddresses", { chainIds, addresses });
  for (const address of addresses) {
    for (const chainId of chainIds) {
      try {
        const found: Match[] = await services.storage.checkAllByChainAndAddress(
          address,
          chainId
        );
        if (found.length != 0) {
          if (!map.has(address)) {
            map.set(address, {
              address,
              chainIds: [],
            });
          }

          map
            .get(address)
            .chainIds.push({ chainId, status: found[0].runtimeMatch });
        }
      } catch (error) {
        // ignore
      }
    }
    if (!map.has(address)) {
      map.set(address, {
        address: address,
        status: "false",
      });
    }
  }
  const resultArray = Array.from(map.values());
  logger.debug("Result checkAllByChainAndAddresses", { resultArray });
  res.send(resultArray);
}

export async function getMetadataEndpoint(req: any, res: Response) {
  const { match, chain, address } = req.params;
  const file = await services.storage.getMetadata(chain, address, match);
  if (file === false) {
    res.status(404).send();
  }
  res.json(JSON.parse(file as string));
}

export async function getFileEndpoint(req: any, res: Response) {
  const { match, chain, address } = req.params;
  const file = await services.storage.getFile(
    chain,
    address,
    match,
    req.params[0]
  );
  if (!file) {
    res.status(404).send();
  }
  res.send(file);
}

export async function checkByChainAndAddressesEnpoint(req: any, res: Response) {
  const map: Map<string, any> = new Map();
  const addresses = req.query.addresses.split(",");
  const chainIds = req.query.chainIds.split(",");
  logger.debug("checkByChainAndAddresses", { chainIds, addresses });
  for (const address of addresses) {
    for (const chainId of chainIds) {
      try {
        const found: Match[] = await services.storage.checkByChainAndAddress(
          address,
          chainId
        );
        if (found.length != 0) {
          if (!map.has(address)) {
            map.set(address, { address, status: "perfect", chainIds: [] });
          }

          map.get(address).chainIds.push(chainId);
        }
      } catch (error) {
        // ignore
      }
    }
    if (!map.has(address)) {
      map.set(address, {
        address: address,
        status: "false",
      });
    }
  }
  const resultArray = Array.from(map.values());
  logger.debug("Result checkByChainAndAddresses", { resultArray });
  res.send(resultArray);
}
