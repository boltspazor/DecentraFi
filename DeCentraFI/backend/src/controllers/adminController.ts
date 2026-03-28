import { Request, Response } from "express";

const ETH_ADDR = /^0x[a-fA-F0-9]{40}$/;

/**
 * GET /api/admin/status?address=0x...
 * Uses server ADMIN_WALLET so the admin UI does not depend on VITE_ADMIN_WALLET at build time.
 */
export function getAdminStatus(req: Request, res: Response) {
  const configured = process.env.ADMIN_WALLET?.trim();
  if (!configured) {
    return res.json({ isAdmin: false, adminConfigured: false });
  }
  const adminLower = configured.toLowerCase();
  const raw = typeof req.query.address === "string" ? req.query.address.trim() : "";
  if (!raw || !ETH_ADDR.test(raw)) {
    return res.json({ isAdmin: false, adminConfigured: true });
  }
  const isAdmin = raw.toLowerCase() === adminLower;
  return res.json({ isAdmin, adminConfigured: true });
}
