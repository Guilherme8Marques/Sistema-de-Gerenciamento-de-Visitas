import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, Leaf } from "lucide-react";

const DOENCAS = [
    "Ferrugem",
    "Cercosporiose",
    "Mancha de Phoma",
    "Antracnose",
    "Rizoctonia",
    "Mancha de Ascochyta",
    "Nematoides (Meloidogyne)",
] as const;

const PRAGAS = [
    "Bicho-Mineiro",
    "Broca-do-Café",
    "Ácaro-Vermelho",
    "Cigarra",
    "Cochonilha",
    "Lagarta-dos-Cafezais",
    "Mosca-das-Frutas",
] as const;

type DoencasPragasModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selected: string[];
    onConfirm: (selected: string[]) => void;
};

const DoencasPragasModal = ({ open, onOpenChange, selected, onConfirm }: DoencasPragasModalProps) => {
    const [localSelected, setLocalSelected] = useState<string[]>([]);

    // Sincronizar estado local com a prop sempre que o modal abre
    useEffect(() => {
        if (open) {
            setLocalSelected([...selected]);
        }
    }, [open, selected]);

    const handleToggle = (item: string) => {
        setLocalSelected((prev) =>
            prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
        );
    };

    const handleConfirm = () => {
        onConfirm(localSelected);
        onOpenChange(false);
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setLocalSelected(selected);
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-card">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-foreground">
                        Selecionar Doenças e Pragas
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Doenças */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-primary">
                            <Leaf className="h-4 w-4" />
                            Doenças
                        </div>
                        <div className="space-y-2">
                            {DOENCAS.map((d) => (
                                <label
                                    key={d}
                                    className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/50"
                                >
                                    <Checkbox
                                        checked={localSelected.includes(d)}
                                        onCheckedChange={() => handleToggle(d)}
                                    />
                                    <span className="text-sm font-medium text-foreground">{d}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Pragas */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-orange-600">
                            <Bug className="h-4 w-4" />
                            Pragas
                        </div>
                        <div className="space-y-2">
                            {PRAGAS.map((p) => (
                                <label
                                    key={p}
                                    className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/50"
                                >
                                    <Checkbox
                                        checked={localSelected.includes(p)}
                                        onCheckedChange={() => handleToggle(p)}
                                    />
                                    <span className="text-sm font-medium text-foreground">{p}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 pt-2">
                    <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                            {localSelected.length} selecionado{localSelected.length !== 1 ? "s" : ""}
                        </span>
                        <Button onClick={handleConfirm} className="font-bold gap-2">
                            Confirmar Seleção
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export { DoencasPragasModal, DOENCAS, PRAGAS };
export default DoencasPragasModal;
