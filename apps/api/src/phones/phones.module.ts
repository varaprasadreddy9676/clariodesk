import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PhonesController } from "./phones.controller.js";
import { PhonesService } from "./phones.service.js";

@Module({
  imports: [AuthModule],
  controllers: [PhonesController],
  providers: [PhonesService],
})
export class PhonesModule {}
