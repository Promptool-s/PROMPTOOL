/**
 * Contrato de datos de la tabla `team_invitations` (esquema inferido del uso
 * real del frontend).
 * status: 'pending' (empresa invita) | 'requested' (usuario pide unirse)
 *         | 'accepted' | 'rejected'
 */
class TeamInvitation {
    id;
    company_id;   // usuario enterprise que "es" la empresa
    user_id;      // receptor (null si se invitó por email a alguien sin cuenta)
    user_email;
    status;
    message;
    created_at;
}

export default TeamInvitation;
