import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/abandoned-cart", (req, res) => {
  try {
    const { email, phone, items, total } = req.body ?? {};

    const hasContact =
      (typeof email === "string" && email.trim().length > 0) ||
      (typeof phone === "string" && phone.trim().length > 0);
    const itemsValid = Array.isArray(items) && items.length > 0;
    const totalNum = Number(total);
    const totalValid = Number.isFinite(totalNum) && totalNum >= 0;

    if (!hasContact || !itemsValid || !totalValid) {
      res.status(400).json({
        error: "validation_error",
        message: "Provide email or phone, a non-empty items array, and a numeric total",
      });
      return;
    }

    const redactEmail = (e: string) => {
      const at = e.indexOf("@");
      if (at <= 0) return "***";
      const local = e.slice(0, at);
      const domain = e.slice(at);
      const head = local.slice(0, Math.min(2, local.length));
      return `${head}***${domain}`;
    };
    const redactPhone = (p: string) => {
      const digits = p.replace(/\D/g, "");
      if (digits.length < 4) return "***";
      return `***${digits.slice(-4)}`;
    };

    logger.info(
      {
        route: "POST /abandoned-cart",
        emailMasked: typeof email === "string" && email.length > 0 ? redactEmail(email) : undefined,
        phoneMasked: typeof phone === "string" && phone.length > 0 ? redactPhone(phone) : undefined,
        itemCount: items.length,
        total: totalNum,
      },
      "Abandoned cart received",
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err, route: "POST /abandoned-cart" }, "Failed to record abandoned cart");
    res.status(500).json({ error: "internal_error", message: "Failed to record abandoned cart" });
  }
});

export default router;
