import { Inject } from "@nestjs/common";
import { TORRIN_SERVICE } from "./constants.js";

export const InjectTorrin = () => Inject(TORRIN_SERVICE);
