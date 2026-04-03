import { ethers } from "ethers";

export function isValidAddress(address: string): boolean {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isAddressOrEmail(value: string): boolean {
  return isValidAddress(value) || isEmail(value);
}
