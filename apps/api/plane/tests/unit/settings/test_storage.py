# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os
from io import BytesIO
from unittest.mock import Mock, patch
import pytest
from plane.settings.storage import S3Storage


@pytest.mark.unit
class TestS3StorageSignedURLExpiration:
    """Test the configurable signed URL expiration in S3Storage"""

    @patch.dict(os.environ, {}, clear=True)
    @patch("plane.settings.storage.boto3")
    def test_default_expiration_without_env_variable(self, mock_boto3):
        """Test that default expiration is 3600 seconds when env variable is not set"""
        # Mock the boto3 client
        mock_boto3.client.return_value = Mock()

        # Create S3Storage instance without SIGNED_URL_EXPIRATION env variable
        storage = S3Storage()

        # Assert default expiration is 3600
        assert storage.signed_url_expiration == 3600

    @patch.dict(os.environ, {"SIGNED_URL_EXPIRATION": "30"}, clear=True)
    @patch("plane.settings.storage.boto3")
    def test_custom_expiration_with_env_variable(self, mock_boto3):
        """Test that expiration is read from SIGNED_URL_EXPIRATION env variable"""
        # Mock the boto3 client
        mock_boto3.client.return_value = Mock()

        # Create S3Storage instance with SIGNED_URL_EXPIRATION=30
        storage = S3Storage()

        # Assert expiration is 30
        assert storage.signed_url_expiration == 30

    @patch.dict(os.environ, {"SIGNED_URL_EXPIRATION": "300"}, clear=True)
    @patch("plane.settings.storage.boto3")
    def test_custom_expiration_multiple_values(self, mock_boto3):
        """Test that expiration works with different custom values"""
        # Mock the boto3 client
        mock_boto3.client.return_value = Mock()

        # Create S3Storage instance with SIGNED_URL_EXPIRATION=300
        storage = S3Storage()

        # Assert expiration is 300
        assert storage.signed_url_expiration == 300

    @patch.dict(
        os.environ,
        {
            "AWS_ACCESS_KEY_ID": "test-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret",
            "AWS_S3_BUCKET_NAME": "test-bucket",
            "AWS_REGION": "us-east-1",
        },
        clear=True,
    )
    @patch("plane.settings.storage.boto3")
    def test_generate_presigned_post_uses_default_expiration(self, mock_boto3):
        """Test that generate_presigned_post uses the configured default expiration"""
        # Mock the boto3 client and its response
        mock_s3_client = Mock()
        mock_s3_client.generate_presigned_post.return_value = {
            "url": "https://test-url.com",
            "fields": {},
        }
        mock_boto3.client.return_value = mock_s3_client

        # Create S3Storage instance
        storage = S3Storage()

        # Call generate_presigned_post without explicit expiration
        storage.generate_presigned_post("test-object", "image/png", 1024)

        # Assert that the boto3 method was called with the default expiration (3600)
        mock_s3_client.generate_presigned_post.assert_called_once()
        call_kwargs = mock_s3_client.generate_presigned_post.call_args[1]
        assert call_kwargs["ExpiresIn"] == 3600

    @patch.dict(
        os.environ,
        {
            "AWS_ACCESS_KEY_ID": "test-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret",
            "AWS_S3_BUCKET_NAME": "test-bucket",
            "AWS_REGION": "us-east-1",
            "SIGNED_URL_EXPIRATION": "60",
        },
        clear=True,
    )
    @patch("plane.settings.storage.boto3")
    def test_generate_presigned_post_uses_custom_expiration(self, mock_boto3):
        """Test that generate_presigned_post uses custom expiration from env variable"""
        # Mock the boto3 client and its response
        mock_s3_client = Mock()
        mock_s3_client.generate_presigned_post.return_value = {
            "url": "https://test-url.com",
            "fields": {},
        }
        mock_boto3.client.return_value = mock_s3_client

        # Create S3Storage instance with SIGNED_URL_EXPIRATION=60
        storage = S3Storage()

        # Call generate_presigned_post without explicit expiration
        storage.generate_presigned_post("test-object", "image/png", 1024)

        # Assert that the boto3 method was called with custom expiration (60)
        mock_s3_client.generate_presigned_post.assert_called_once()
        call_kwargs = mock_s3_client.generate_presigned_post.call_args[1]
        assert call_kwargs["ExpiresIn"] == 60

    @patch.dict(
        os.environ,
        {
            "AWS_ACCESS_KEY_ID": "test-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret",
            "AWS_S3_BUCKET_NAME": "test-bucket",
            "AWS_REGION": "us-east-1",
        },
        clear=True,
    )
    @patch("plane.settings.storage.boto3")
    def test_generate_presigned_url_uses_default_expiration(self, mock_boto3):
        """Test that generate_presigned_url uses the configured default expiration"""
        # Mock the boto3 client and its response
        mock_s3_client = Mock()
        mock_s3_client.generate_presigned_url.return_value = "https://test-url.com"
        mock_boto3.client.return_value = mock_s3_client

        # Create S3Storage instance
        storage = S3Storage()

        # Call generate_presigned_url without explicit expiration
        storage.generate_presigned_url("test-object")

        # Assert that the boto3 method was called with the default expiration (3600)
        mock_s3_client.generate_presigned_url.assert_called_once()
        call_kwargs = mock_s3_client.generate_presigned_url.call_args[1]
        assert call_kwargs["ExpiresIn"] == 3600

    @patch.dict(
        os.environ,
        {
            "AWS_ACCESS_KEY_ID": "test-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret",
            "AWS_S3_BUCKET_NAME": "test-bucket",
            "AWS_REGION": "us-east-1",
            "SIGNED_URL_EXPIRATION": "30",
        },
        clear=True,
    )
    @patch("plane.settings.storage.boto3")
    def test_generate_presigned_url_uses_custom_expiration(self, mock_boto3):
        """Test that generate_presigned_url uses custom expiration from env variable"""
        # Mock the boto3 client and its response
        mock_s3_client = Mock()
        mock_s3_client.generate_presigned_url.return_value = "https://test-url.com"
        mock_boto3.client.return_value = mock_s3_client

        # Create S3Storage instance with SIGNED_URL_EXPIRATION=30
        storage = S3Storage()

        # Call generate_presigned_url without explicit expiration
        storage.generate_presigned_url("test-object")

        # Assert that the boto3 method was called with custom expiration (30)
        mock_s3_client.generate_presigned_url.assert_called_once()
        call_kwargs = mock_s3_client.generate_presigned_url.call_args[1]
        assert call_kwargs["ExpiresIn"] == 30

    @patch.dict(
        os.environ,
        {
            "AWS_ACCESS_KEY_ID": "test-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret",
            "AWS_S3_BUCKET_NAME": "test-bucket",
            "AWS_REGION": "us-east-1",
            "SIGNED_URL_EXPIRATION": "30",
        },
        clear=True,
    )
    @patch("plane.settings.storage.boto3")
    def test_explicit_expiration_overrides_default(self, mock_boto3):
        """Test that explicit expiration parameter overrides the default"""
        # Mock the boto3 client and its response
        mock_s3_client = Mock()
        mock_s3_client.generate_presigned_url.return_value = "https://test-url.com"
        mock_boto3.client.return_value = mock_s3_client

        # Create S3Storage instance with SIGNED_URL_EXPIRATION=30
        storage = S3Storage()

        # Call generate_presigned_url with explicit expiration=120
        storage.generate_presigned_url("test-object", expiration=120)

        # Assert that the boto3 method was called with explicit expiration (120)
        mock_s3_client.generate_presigned_url.assert_called_once()
        call_kwargs = mock_s3_client.generate_presigned_url.call_args[1]
        assert call_kwargs["ExpiresIn"] == 120


@pytest.mark.unit
class TestS3StoragePublicEndpoint:
    @pytest.mark.parametrize("use_minio", ["0", "1"])
    @pytest.mark.parametrize("public_endpoint", ["", "http://localhost:9000"])
    @patch("plane.settings.storage.boto3")
    def test_signing_endpoint_and_internal_operations(self, mock_boto3, use_minio, public_endpoint):
        internal_client = Mock()
        public_client = Mock()
        mock_boto3.client.side_effect = [internal_client, public_client]
        env = {
            "USE_MINIO": use_minio,
            "AWS_ACCESS_KEY_ID": "test-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret",
            "AWS_S3_BUCKET_NAME": "uploads",
            "AWS_REGION": "us-east-1",
            "AWS_S3_ENDPOINT_URL": "http://plane-minio:9000",
            "AWS_S3_PUBLIC_ENDPOINT_URL": public_endpoint,
        }
        with patch.dict(os.environ, env, clear=True):
            storage = S3Storage()

        assert mock_boto3.client.call_args_list[0].kwargs["endpoint_url"] == "http://plane-minio:9000"
        signing_client = public_client if public_endpoint else internal_client
        assert storage.presign_client is signing_client
        assert mock_boto3.client.call_count == (2 if public_endpoint else 1)
        if public_endpoint:
            assert mock_boto3.client.call_args.kwargs["endpoint_url"] == public_endpoint

        storage.generate_presigned_post("test.txt", "text/plain", 10)
        storage.generate_presigned_url("test.txt", expiration=120)
        signing_client.generate_presigned_post.assert_called_once()
        signing_client.generate_presigned_url.assert_called_once()
        assert signing_client.generate_presigned_url.call_args.kwargs["ExpiresIn"] == 120

        internal_client.head_object.return_value = {"ContentLength": 10}
        assert storage.get_object_metadata("test.txt")["ContentLength"] == 10
        storage.copy_object("test.txt", "copy.txt")
        storage.upload_file(BytesIO(b"test"), "direct.txt")
        storage.delete_files(["test.txt"])
        internal_client.head_object.assert_called_once()
        internal_client.copy_object.assert_called_once()
        internal_client.upload_fileobj.assert_called_once()
        internal_client.delete_objects.assert_called_once()
        if public_endpoint:
            public_client.head_object.assert_not_called()
            public_client.copy_object.assert_not_called()
            public_client.upload_fileobj.assert_not_called()
            public_client.delete_objects.assert_not_called()

    @patch.dict(os.environ, {"USE_MINIO": "1"}, clear=True)
    @patch("plane.settings.storage.boto3")
    def test_existing_proxy_mode_keeps_request_host(self, mock_boto3):
        request = Mock(scheme="https")
        request.get_host.return_value = "plane.example.com"
        storage = S3Storage(request=request)

        assert mock_boto3.client.call_args.kwargs["endpoint_url"] == "https://plane.example.com"
        assert storage.presign_client is storage.s3_client
        mock_boto3.client.assert_called_once()

    @pytest.mark.parametrize("public_endpoint", ["", "http://localhost:9000"])
    @patch("plane.bgtasks.export_task.ExporterHistory")
    @patch("plane.bgtasks.export_task.boto3.client")
    def test_background_export_signs_public_url(self, mock_client, mock_history, public_endpoint, settings):
        from plane.bgtasks.export_task import upload_to_s3

        settings.USE_MINIO = False
        settings.AWS_S3_ENDPOINT_URL = "http://plane-minio:9000"
        internal_client, public_client = Mock(), Mock()
        mock_client.side_effect = [internal_client, public_client]
        signing_client = public_client if public_endpoint else internal_client
        signing_client.generate_presigned_url.return_value = "http://download.example/test.zip"

        with patch.dict(os.environ, {"AWS_S3_PUBLIC_ENDPOINT_URL": public_endpoint}):
            upload_to_s3(BytesIO(b"test"), "workspace-id", "token-id", "workspace")

        assert mock_client.call_args_list[0].kwargs["endpoint_url"] == "http://plane-minio:9000"
        internal_client.upload_fileobj.assert_called_once()
        signing_client.generate_presigned_url.assert_called_once()
        if public_endpoint:
            assert mock_client.call_args.kwargs["endpoint_url"] == public_endpoint
            public_client.upload_fileobj.assert_not_called()
        else:
            mock_client.assert_called_once()
        assert mock_history.objects.get.return_value.url == "http://download.example/test.zip"
