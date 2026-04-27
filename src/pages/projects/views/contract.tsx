/**
 * Aba "Contrato" do detalhe — visível em fase contract+.
 *
 * Versão atual: placeholder. Funcionalidades planejadas:
 *   - Upload do arquivo do contrato (PDF assinado/draft)
 *   - Parametrização do contrato (data de vigência, cláusulas relevantes)
 *   - Status interno (em elaboração, aguardando assinatura, assinado)
 *   - Histórico de revisões do contrato
 *
 * Quando implementado, fica fonte de pré-requisito pra transição → won
 * (Workflow Rules vai conferir presença de contrato anexado).
 */
import { FileText } from 'lucide-react'

import { Card, CardContent } from '@/shared/ui/card'

export function ProjectContractView() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="rounded-full bg-muted p-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">Gestão de Contrato</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Em breve você poderá fazer upload do arquivo do contrato,
            parametrizar cláusulas e acompanhar o estado interno
            (em elaboração, aguardando assinatura, assinado).
          </p>
          <p className="mt-2 max-w-md text-xs text-muted-foreground">
            Esta aba aparece apenas em oportunidades na fase de Contrato
            ou em projetos pós-ganho.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
