import unittest
from static_compression import transform


class CompressionTest(unittest.TestCase):
    def test_main_static_location_keeps_other_routes_and_cache_policy(self):
        source = 'server { location /api/ { proxy_pass http://localhost:3000; }\nlocation ~* \\.(?:css|js|svg)$ {\nadd_header Cache-Control "no-store";\n} }'
        result = transform(source, 'flowsee.ir')
        self.assertIn('location /api/ { proxy_pass http://localhost:3000; }', result)
        self.assertIn('add_header Cache-Control "no-store";', result)
        self.assertEqual(transform(result, 'flowsee.ir'), result)

    def test_studio_gzip_is_scoped_to_public_assets_and_preserves_headers(self):
        source = 'server {\n root /var/www/flowsee-studio/dist;\n location ^~ /api/ { proxy_pass http://localhost:3000; }\n add_header Cache-Control "no-store";\n}'
        result = transform(source, 'studio.flowsee.ir')
        self.assertIn('location ~* ^/assets/', result)
        self.assertIn('location ^~ /api/ { proxy_pass http://localhost:3000; }', result)
        self.assertIn('add_header Cache-Control "no-store";', result)
        self.assertEqual(transform(result, 'studio.flowsee.ir'), result)

    def test_unexpected_configuration_is_rejected(self):
        for domain in ('flowsee.ir', 'studio.flowsee.ir'):
            with self.assertRaises(ValueError):
                transform('server {}', domain)


if __name__ == '__main__':
    unittest.main()
