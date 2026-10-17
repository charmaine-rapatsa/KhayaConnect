import json
from contextlib import nullcontext
from io import StringIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.contrib.auth.hashers import check_password
from django.core.management import call_command
from django.test import Client, SimpleTestCase


class LoginCsrfTests(SimpleTestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def test_csrf_bootstrap_issues_a_token(self):
        response = self.client.get("/api/csrf/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["csrf_token"])
        self.assertIn("csrftoken", self.client.cookies)

    def test_login_rejects_requests_without_csrf(self):
        response = self.client.post(
            "/api/login/",
            data="{}",
            content_type="application/json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 403)

    def test_login_with_csrf_reaches_input_validation(self):
        token_response = self.client.get("/api/csrf/", HTTP_HOST="localhost")
        token = token_response.json()["csrf_token"]
        response = self.client.post(
            "/api/login/",
            data="{}",
            content_type="application/json",
            HTTP_HOST="localhost",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Phone number and password are required")

    def test_notifications_require_a_signed_in_user(self):
        response = self.client.get("/api/notifications/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "Please sign in to continue")


class RegistrationEndpointTests(SimpleTestCase):
    def test_registration_requires_an_admin_session(self):
        with patch("core.views._session_user", return_value=None):
            response = Client().post(
                "/api/register/",
                data=json.dumps({"full_name": "Test User", "phone": "000", "password": "test", "role": "elderly"}),
                content_type="application/json",
                HTTP_HOST="localhost",
            )

        self.assertEqual(response.status_code, 401)

    def test_admin_registration_saves_hashed_password_to_users_model(self):
        registered_user = SimpleNamespace(
            user_id=901,
            full_name="Assessment Test",
            phone="0000000000",
            password="",
            role="elderly",
        )
        with (
            patch("core.views._session_user", return_value=SimpleNamespace(user_id=1, role="admin")),
            patch("core.views.Users.objects.filter") as filter_users,
            patch("core.views.Users.objects.create", return_value=registered_user) as create_user,
            patch("core.views.transaction.atomic", return_value=nullcontext()),
            patch("core.views._record_admin_action") as record_action,
        ):
            filter_users.return_value.exists.return_value = False
            response = Client().post(
                "/api/register/",
                data=json.dumps({
                    "full_name": "Assessment Test",
                    "phone": "0000000000",
                    "password": "Example-Assessment-Password-23!",
                    "role": "elderly",
                }),
                content_type="application/json",
                HTTP_HOST="localhost",
            )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(check_password("Example-Assessment-Password-23!", create_user.call_args.kwargs["password"]))
        self.assertNotEqual(create_user.call_args.kwargs["password"], "Example-Assessment-Password-23!")
        self.assertEqual(response.json()["user_id"], 901)
        record_action.assert_called_once()
        actor, action_type, description = record_action.call_args.args
        self.assertEqual(actor.user_id, 1)
        self.assertEqual(action_type, "user_created")
        self.assertIn("901", description)
        self.assertNotIn("Example-Assessment-Password-23!", description)


class PasswordRecoveryTests(SimpleTestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def test_request_response_is_generic_and_code_is_not_returned(self):
        account = SimpleNamespace(user_id=71)
        with self.settings(DEBUG=True):
            with (
                patch("core.views.Users.objects.filter") as users_filter,
                patch("builtins.print") as terminal_print,
            ):
                users_filter.return_value.first.return_value = account
                response = Client().post(
                    "/api/password-reset/request/",
                    data=json.dumps({"phone": "0712345678"}),
                    content_type="application/json",
                    HTTP_HOST="localhost",
                )
        self.assertEqual(response.status_code, 200)
        self.assertIn("If an account matches", response.json()["message"])
        self.assertNotIn("code", response.json())
        terminal_print.assert_called_once()
        self.assertIn("Verification code", terminal_print.call_args.args[0])

    def test_confirm_rejects_wrong_code_without_changing_password(self):
        from django.core.cache import cache
        from core.views import _password_reset_key
        cache.set(_password_reset_key("code", "0712345678"), {"code": "112233", "attempts": 0, "user_id": 71}, timeout=600)
        with self.settings(DEBUG=True):
            response = Client().post(
                "/api/password-reset/confirm/",
                data=json.dumps({"phone": "0712345678", "code": "999999", "new_password": "Strong-Password-247!"}),
                content_type="application/json",
                HTTP_HOST="localhost",
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("invalid or expired", response.json()["error"])

    def test_confirm_updates_password_as_a_hash_and_consumes_code(self):
        from django.core.cache import cache
        from core.views import _password_reset_key
        phone = "0712345678"
        password = "Khaya-Reset-Demo-Password-572!"
        account = SimpleNamespace(user_id=71, phone=phone, full_name="Demo User", password="old-hash", save=MagicMock())
        key = _password_reset_key("code", phone)
        cache.set(key, {"code": "112233", "attempts": 0, "user_id": account.user_id}, timeout=600)
        with self.settings(DEBUG=True):
            with (
                patch("core.views.Users.objects.filter") as users_filter,
                patch("core.views.Session.objects.all") as sessions,
                patch("core.views.transaction.atomic", return_value=nullcontext()),
            ):
                users_filter.return_value.first.return_value = account
                sessions.return_value.iterator.return_value = []
                response = Client().post(
                    "/api/password-reset/confirm/",
                    data=json.dumps({"phone": phone, "code": "112233", "new_password": password}),
                    content_type="application/json",
                    HTTP_HOST="localhost",
                )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(check_password(password, account.password))
        account.save.assert_called_once_with(update_fields=["password"])
        self.assertIsNone(cache.get(key))


class AdminPasswordResetCommandTests(SimpleTestCase):
    @patch("core.management.commands.reset_khayaconnect_admin_password.getpass")
    @patch("builtins.input", return_value="cancel")
    @patch("core.management.commands.reset_khayaconnect_admin_password.Users.objects.filter")
    def test_cancel_leaves_account_unchanged(self, filter_users, _input, get_password):
        account = SimpleNamespace(user_id=27, role="admin", password="existing-hash")
        queryset = SimpleNamespace(first=lambda: account)
        filter_users.return_value = queryset
        get_password.side_effect = ["A-Strong-Test-Only-Password-247!", "A-Strong-Test-Only-Password-247!"]
        output = StringIO()

        call_command("reset_khayaconnect_admin_password", "27", stdout=output)

        self.assertIn("Cancelled. No changes were made.", output.getvalue())
        self.assertEqual(account.password, "existing-hash")
