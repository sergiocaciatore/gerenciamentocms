from fastapi import Header, HTTPException, status
from app.auth.firebase import verify_token


async def get_current_user(authorization: str = Header(None)):
    """
    Obtém o usuário atual a partir do token de autorização.

    Args:
        authorization (str): Token Bearer presente no cabeçalho Authorization.

    Returns:
        dict: Dados do usuário decodificados do token.

    Raises:
        HTTPException: Se o token estiver ausente, inválido ou expirado.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabeçalho de autorização ausente",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esquema de autenticação inválido",
        )

    token = authorization.split(" ")[1]
    decoded_token = verify_token(token)

    if not decoded_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )

    return decoded_token
