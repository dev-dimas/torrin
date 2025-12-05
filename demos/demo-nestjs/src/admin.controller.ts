import { Controller, Post } from "@nestjs/common";
import { getTorrinService } from "./app.module";

@Controller("admin")
export class AdminController {
  @Post("cleanup")
  async cleanup() {
    const service = getTorrinService();
    if (!service) {
      return { cleaned: 0, errors: ["Service not initialized"] };
    }
    
    const result = await service.cleanupExpiredUploads();
    console.log(`[CLEANUP] Cleaned ${result.cleaned} expired uploads`);
    if (result.errors.length > 0) {
      console.log(`[CLEANUP] Errors:`, result.errors);
    }
    return result;
  }
}
