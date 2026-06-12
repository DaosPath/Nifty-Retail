# -*- coding: utf-8 -*-
"""Genera la guía de uso NiftyPOS en PDF."""

from pathlib import Path

from fpdf import FPDF

OUTPUT = Path(__file__).resolve().parent.parent / "release" / "Guia-NiftyPOS.pdf"

MAGENTA = (194, 17, 122)
CYAN = (0, 181, 226)
DARK = (31, 35, 41)
MUTED = (90, 96, 105)


class GuiaPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "NiftyPOS - Guia de uso", align="C")
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 10, f"Pagina {self.page_no()}", align="C")

    def portada(self):
        self.add_page()
        self.set_fill_color(*MAGENTA)
        self.rect(0, 0, 210, 55, style="F")
        self.set_y(18)
        self.set_font("Helvetica", "B", 28)
        self.set_text_color(255, 255, 255)
        self.cell(0, 12, "NiftyPOS", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 14)
        self.cell(0, 10, "Guia rapida de uso", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(20)
        self.set_text_color(*DARK)
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 10, "Mi Tienda (ejemplo)", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "RUC: (configurar en la app)", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(8)
        self.cell(0, 8, "Versión 0.1.0  |  Junio 2026", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(30)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(
            0,
            7,
            "Esta guia explica como instalar NiftyPOS, operar el punto de venta, "
            "configurar boletas electronicas SUNAT y probar el sistema paso a paso.",
            align="C",
        )

    def seccion(self, numero: str, titulo: str):
        self.ln(4)
        self.set_fill_color(240, 244, 249)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*CYAN)
        self.cell(0, 10, f"  {numero}. {titulo}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(3)
        self.set_text_color(*DARK)
        self.set_font("Helvetica", "", 10)

    def parrafo(self, texto: str):
        self.multi_cell(0, 6, texto)
        self.ln(2)

    def paso(self, n: int, texto: str):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*MAGENTA)
        self.cell(12, 6, f"{n}.")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*DARK)
        self.multi_cell(0, 6, texto)
        self.ln(1)

    def tabla_simple(self, headers: list[str], rows: list[list[str]]):
        col_w = (self.w - self.l_margin - self.r_margin) / len(headers)
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(230, 236, 245)
        for h in headers:
            self.cell(col_w, 8, h, border=1, fill=True)
        self.ln()
        self.set_font("Helvetica", "", 9)
        for row in rows:
            for cell in row:
                self.cell(col_w, 8, cell, border=1)
            self.ln()
        self.ln(3)

    def nota(self, texto: str):
        self.set_fill_color(255, 249, 230)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(120, 80, 0)
        self.cell(0, 7, "  Nota", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.multi_cell(0, 6, texto, fill=True)
        self.ln(3)
        self.set_text_color(*DARK)


def build_pdf():
    pdf = GuiaPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.portada()

    pdf.add_page()
    pdf.seccion("1", "Instalacion")
    pdf.paso(1, "Ejecuta el instalador: release\\NiftyPOS-0.1.0-setup.exe")
    pdf.paso(2, "Sigue el asistente (Siguiente > Instalar > Finalizar).")
    pdf.paso(3, "Abre NiftyPOS desde el menú Inicio o el acceso directo del escritorio.")
    pdf.nota(
        "Los datos se guardan localmente en tu PC, en:\n"
        "%LOCALAPPDATA%\\com.niftypos.app\\data\\nifty_pos.db"
    )

    pdf.seccion("2", "Primer uso - flujo diario")
    pdf.paso(1, "Ve a la pestaña Caja y pulsa Abrir caja. Ingresa el monto inicial en efectivo.")
    pdf.paso(2, "En POS, busca productos por nombre o escanea el código de barras.")
    pdf.paso(3, "Agrega productos al carrito y revisa cantidades y precios.")
    pdf.paso(4, "Elige el tipo de comprobante: Ticket o Boleta.")
    pdf.paso(5, "Selecciona método de pago: Efectivo, Tarjeta, Yape o Fiado.")
    pdf.paso(6, "Pulsa Registrar e Imprimir para guardar la venta e imprimir el recibo.")
    pdf.paso(7, "Al terminar el turno, ve a Caja > Cerrar caja para hacer el cuadre.")

    pdf.seccion("3", "Ticket vs Boleta")
    pdf.tabla_simple(
        ["Tipo", "Uso", "SUNAT"],
        [
            ["Ticket", "Control interno de caja", "No se envia a SUNAT"],
            ["Boleta", "Venta al consumidor final", "Electronica si SUNAT activo"],
        ],
    )
    pdf.parrafo(
        "Boletas de S/ 700.00 o más exigen DNI y nombre del cliente. "
        "Boletas menores a S/ 700 pueden registrarse para resumen diario SUNAT."
    )

    pdf.add_page()
    pdf.seccion("4", "Configuracion de la tienda")
    pdf.paso(1, "Abre Configuracion > Informacion de la Tienda.")
    pdf.paso(2, "Verifica: nombre del negocio, RUC, direccion y series T001 / B001.")
    pdf.paso(3, "Guarda los cambios.")
    pdf.parrafo("Tambien puedes cambiar tema (oscuro/claro), impresora y mensaje al pie del recibo.")

    pdf.seccion("5", "Inventario y productos")
    pdf.paso(1, "Pestaña Inventario: agrega, edita o elimina productos.")
    pdf.paso(2, "Define código, nombre, categoría, precios y stock mínimo.")
    pdf.paso(3, "Gestiona lotes y fechas de vencimiento desde el botón Lotes.")
    pdf.paso(4, "Alertas avisa cuando hay stock bajo o productos por vencer.")

    pdf.seccion("6", "Historial y reimpresion")
    pdf.paso(1, "Pestaña Historial de ventas: busca por número, fecha o producto.")
    pdf.paso(2, "Abre el detalle de una venta para ver productos y totales.")
    pdf.paso(3, "Usa Reimprimir para volver a imprimir el comprobante.")

    pdf.seccion("7", "Fiados (credito a clientes)")
    pdf.paso(1, "Registra clientes en la pestaña Fiados.")
    pdf.paso(2, "Al cobrar, elige método Fiado y selecciona el cliente.")
    pdf.paso(3, "Registra abonos cuando el cliente pague su deuda.")

    pdf.add_page()
    pdf.seccion("8", "Facturacion electronica SUNAT (opcional)")
    pdf.parrafo(
        "Para emitir boletas electronicas validas necesitas credenciales de SUNAT "
        "(no son del Facturador, son de SUNAT): usuario SOL, clave SOL, certificado .pfx "
        "y contrasena del certificado."
    )
    pdf.paso(1, "Configuracion > Facturacion Electronica SUNAT.")
    pdf.paso(2, "Completa usuario SOL, clave, ruta del .pfx y contrasena.")
    pdf.paso(3, "Ambiente: Pruebas (beta) para probar; Produccion cuando todo funcione.")
    pdf.paso(4, "Pulsa Probar certificado y credenciales.")
    pdf.paso(5, "Activa Habilitar emision electronica de boletas y guarda.")

    pdf.seccion("9", "Como probar SUNAT en beta")
    pdf.paso(1, "Abre caja.")
    pdf.paso(2, "Haz una venta con Boleta de S/ 700 o más (con DNI y nombre).")
    pdf.paso(3, "El boton dira Enviando a SUNAT... mientras emite.")
    pdf.paso(4, "Si SUNAT acepta: el ticket muestra Comprobante aceptado por SUNAT (CDR 0).")
    pdf.paso(5, "Si falla: aparece un mensaje de error y la venta NO se guarda.")
    pdf.nota(
        "Sin credenciales SUNAT puedes usar NiftyPOS con tickets y boletas internas. "
        "La emision electronica real requiere certificado y usuario SOL activos."
    )

    pdf.seccion("10", "Respaldo de datos")
    pdf.paso(1, "Configuracion > Exportar respaldo completo (todo).")
    pdf.paso(2, "Guarda el archivo JSON en un lugar seguro (USB, nube, etc.).")
    pdf.paso(3, "Importar respaldo completo restaura productos, ventas y configuracion.")

    pdf.seccion("11", "Solucion de problemas")
    pdf.tabla_simple(
        ["Problema", "Qué hacer"],
        [
            ["No puedo vender", "Abre caja primero en la pestaña Caja"],
            ["No imprime", "Verifica impresora predeterminada; usa Reimprimir"],
            ["SUNAT rechaza boleta", "Revisa credenciales, certificado y ambiente beta"],
            ["Perdí datos", "Restaura desde respaldo JSON"],
        ],
    )

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*MAGENTA)
    pdf.cell(0, 8, "Soporte", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*DARK)
    pdf.parrafo(
        "Instalador: release\\NiftyPOS-0.1.0-setup.exe\n"
        "Guia PDF: release\\Guia-NiftyPOS.pdf"
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    return OUTPUT


if __name__ == "__main__":
    path = build_pdf()
    print(f"PDF generado: {path}")