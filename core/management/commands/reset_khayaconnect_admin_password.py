from getpass import getpass

from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.models import Users


class Command(BaseCommand):
    help = "Safely reset one KhayaConnect administrator password and revoke their sessions."

    def add_arguments(self, parser):
        parser.add_argument("user_id", type=int, help="The custom administrator user ID.")

    def handle(self, *args, **options):
        user_id = options["user_id"]
        account = Users.objects.filter(user_id=user_id, role="admin").first()
        if account is None:
            raise CommandError("No administrator account exists with that user ID.")

        password = getpass("New password (input hidden): ")
        confirmation = getpass("Confirm new password (input hidden): ")
        if password != confirmation:
            raise CommandError("The passwords did not match. No changes were made.")
        if not password:
            raise CommandError("The password cannot be empty. No changes were made.")
        try:
            validate_password(password)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from None

        confirmation = input(
            f"Type RESET {user_id} to update this account and sign it out everywhere: "
        )
        if confirmation != f"RESET {user_id}":
            self.stdout.write("Cancelled. No changes were made.")
            return

        revoked_sessions = 0
        with transaction.atomic():
            account.password = make_password(password)
            account.save(update_fields=["password"])

            active_sessions = Session.objects.filter(expire_date__gt=timezone.now())
            for session in active_sessions.iterator():
                session_data = session.get_decoded()
                if str(session_data.get("user_id")) == str(user_id):
                    session.delete()
                    revoked_sessions += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Password updated for administrator ID {user_id}; "
                f"{revoked_sessions} active session(s) revoked."
            )
        )
