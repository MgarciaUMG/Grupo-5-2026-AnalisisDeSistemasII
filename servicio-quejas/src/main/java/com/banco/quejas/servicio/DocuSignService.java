package com.banco.quejas.servicio;

import com.docusign.esign.api.EnvelopesApi;
import com.docusign.esign.client.ApiClient;
import com.docusign.esign.client.auth.OAuth;
import com.docusign.esign.model.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.nio.file.Files;
import java.nio.file.Path;

import java.util.Collections;
import java.util.Base64;

@Service
public class DocuSignService {

    @Value("${docusign.client-id}")
    private String clientId;

    @Value("${docusign.user-id}")
    private String userId;

    @Value("${docusign.auth-server}")
    private String authServer;

    @Value("${docusign.base-path}")
    private String basePath;

    @Value("${docusign.private-key-path:/etc/quejas-bancarias/docusign-private.key}")
    private String privateKeyPath;

    @Value("${app.frontend-url:https://bcnenlinea.eastus2.cloudapp.azure.com}")
    private String frontendUrl;

    // Método principal para generar la URL de firma embebida
    public java.util.Map<String, String> generarUrlDeFirma(String usuarioId, String nombre, String email,
            byte[] pdfBytes, String numeroTicket, String rutaRetorno)
            throws Exception {
        ApiClient apiClient = autenticarDocuSign();
        EnvelopesApi envelopesApi = new EnvelopesApi(apiClient);

        EnvelopeDefinition envelopeDefinition = new EnvelopeDefinition();
        envelopeDefinition.setEmailSubject("Firma requerida: Resolución del Ticket " + numeroTicket);

        // Documento PDF de prueba en Base64 (puedes reemplazarlo por tus bytes reales)
        String pdfBase64 = Base64.getEncoder().encodeToString(pdfBytes);

        Document documento = new Document();
        documento.setDocumentBase64(pdfBase64);
        documento.setName("Resolucion_" + numeroTicket);
        documento.setFileExtension("pdf");
        documento.setDocumentId("1");
        envelopeDefinition.setDocuments(Collections.singletonList(documento));

        // 2. Configurar el firmante (Signer)
        Signer firmante = new Signer();
        firmante.setEmail(email);
        firmante.setName(nombre);
        firmante.setRecipientId("1");

        // CRUCIAL: clientUserId convierte la firma en "Embebida" y la ata al ID de tu
        // usuario local
        firmante.setClientUserId(usuarioId);

        // Etiqueta donde el usuario firmará
        SignHere signHere = new SignHere();
        signHere.setDocumentId("1");

        // El marcador debe existir en el PDF generado.
        signHere.setAnchorString("[[FIRMA_AGENTE]]");
        signHere.setAnchorCaseSensitive("true");
        signHere.setAnchorMatchWholeWord("true");

        // Ajustes iniciales; afinar según el PDF real.
        signHere.setAnchorUnits("pixels");
        signHere.setAnchorXOffset("0");
        signHere.setAnchorYOffset("8");

        Tabs tabs = new Tabs();
        tabs.setSignHereTabs(Collections.singletonList(signHere));
        firmante.setTabs(tabs);

        Recipients recipients = new Recipients();
        recipients.setSigners(Collections.singletonList(firmante));
        envelopeDefinition.setRecipients(recipients);
        envelopeDefinition.setStatus("sent");

        // 3. Enviar el sobre a DocuSign y obtener el Envelope ID
        com.docusign.esign.client.auth.OAuth.UserInfo userInfo = apiClient.getUserInfo(apiClient.getAccessToken());
        String accountId = userInfo.getAccounts().get(0).getAccountId();

        // ---> LA SOLUCIÓN DEL 404 ESTÁ AQUÍ <---
        // Actualizamos dinámicamente la ruta base hacia el servidor correcto de Firmas
        String baseUri = userInfo.getAccounts().get(0).getBaseUri() + "/restapi";
        apiClient.setBasePath(baseUri);
        // ----------------------------------------

        EnvelopeSummary results = envelopesApi.createEnvelope(accountId, envelopeDefinition);
        String envelopeId = results.getEnvelopeId();

        // 4. Generar la vista de firma (Recipient View)
        RecipientViewRequest viewRequest = new RecipientViewRequest();
        String baseUrl = frontendUrl.replaceAll("/+$", "");
        String ruta = rutaRetorno.startsWith("/") ? rutaRetorno : "/" + rutaRetorno;
        String separador = ruta.contains("?") ? "&" : "?";

         viewRequest.setReturnUrl(
         baseUrl + ruta + separador + "ticketFirma=" + numeroTicket
        );
        viewRequest.setAuthenticationMethod("none");
        viewRequest.setEmail(email);
        viewRequest.setUserName(nombre);
        // Debe coincidir exactamente con el configurado en el Signer
        viewRequest.setClientUserId(usuarioId);

        ViewUrl viewUrl = envelopesApi.createRecipientView(accountId, envelopeId, viewRequest);
        java.util.Map<String, String> respuesta = new java.util.HashMap<>();
        respuesta.put("url", viewUrl.getUrl());
        respuesta.put("envelopeId", envelopeId); // ¡Atrapamos el ID del documento!

        return respuesta;
    }

    // Autenticación Server-to-Server (JWT Grant)
    private ApiClient autenticarDocuSign() throws Exception {
        ApiClient apiClient = new ApiClient(basePath);

        // Leer private.key desde src/main/resources
        byte[] privateKeyBytes = Files.readAllBytes(Path.of(privateKeyPath));

        java.util.List<String> scopes = java.util.Arrays.asList(OAuth.Scope_SIGNATURE, OAuth.Scope_IMPERSONATION);

        OAuth.OAuthToken oAuthToken = apiClient.requestJWTUserToken(
                clientId,
                userId,
                scopes,
                privateKeyBytes,
                3600 // 1 hora de validez
        );

        apiClient.setAccessToken(oAuthToken.getAccessToken(), oAuthToken.getExpiresIn());
        return apiClient;
    }

    // ==========================================
    public byte[] descargarDocumentoFirmado(String envelopeId) throws Exception {
        ApiClient apiClient = autenticarDocuSign();
        EnvelopesApi envelopesApi = new EnvelopesApi(apiClient);

        com.docusign.esign.client.auth.OAuth.UserInfo userInfo = apiClient.getUserInfo(apiClient.getAccessToken());
        String accountId = userInfo.getAccounts().get(0).getAccountId();
        String baseUri = userInfo.getAccounts().get(0).getBaseUri() + "/restapi";
        apiClient.setBasePath(baseUri);

        // "1" es el documentId que le asignamos cuando lo subimos
        return envelopesApi.getDocument(accountId, envelopeId, "1");
    }

}
