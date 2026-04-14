"use client";

import { useLocalTableModeAdapter } from "@/features/table/adapters/useLocalTableModeAdapter";
import { TableModeScreen } from "@/features/table/presentation/table-mode-screen";

export default function LocalModePage() {
  const adapter = useLocalTableModeAdapter();

  return <TableModeScreen adapter={adapter} />;
}
