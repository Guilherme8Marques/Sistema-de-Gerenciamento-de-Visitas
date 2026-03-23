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
            <DialogContent className="max-w-md max-h-[85vh] text-white overflow-hidden flex flex-col glass-card-strong bg-transparent border border-white/20 shadow-2xl p-0">
                <div className="bg-primary px-5 py-4 border-b border-white/10 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-display font-bold text-primary-foreground flex items-center gap-2">
                            <Bug className="h-5 w-5" />
                            Selecionar Doenças e Pragas
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="px-5 py-5 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* Doenças */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-green-400">
                            <Leaf className="h-4 w-4" />
                            Doenças
                        </div>
                        <div className="space-y-2">
                            {DOENCAS.map((d) => (
                                <label
                                    key={d}
                                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 cursor-pointer transition-colors hover:bg-white/10 group"
                                >
                                    <Checkbox
                                        checked={localSelected.includes(d)}
                                        onCheckedChange={() => handleToggle(d)}
                                        className="border-white/50 data-[state=checked]:bg-green-500 data-[state=checked]:border-none text-white"
                                    />
                                    <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{d}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Pragas */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-orange-400">
                            <Bug className="h-4 w-4" />
                            Pragas
                        </div>
                        <div className="space-y-2">
                            {PRAGAS.map((p) => (
                                <label
                                    key={p}
                                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 cursor-pointer transition-colors hover:bg-white/10 group"
                                >
                                    <Checkbox
                                        checked={localSelected.includes(p)}
                                        onCheckedChange={() => handleToggle(p)}
                                        className="border-white/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-none text-white"
                                    />
                                    <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{p}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-white/10 bg-white/5 shrink-0">
                    <DialogFooter className="flex gap-2">
                        <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-xs font-bold text-white/50 bg-black/20 px-2 py-1 rounded-md">
                                {localSelected.length} selecionado{localSelected.length !== 1 ? "s" : ""}
                            </span>
                            <Button onClick={handleConfirm} className="font-bold gap-2 bg-primary hover:bg-green-600 text-primary-foreground border-none rounded-full h-10 px-8">
                                Confirmar Seleção
                            </Button>
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export { DoencasPragasModal, DOENCAS, PRAGAS };
export default DoencasPragasModal;
