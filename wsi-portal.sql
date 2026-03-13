-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 13, 2026 at 06:27 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `wsi-portal`
--

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_services`
--

CREATE TABLE `customer_services` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `service_id` bigint UNSIGNED NOT NULL,
  `order_item_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','expired','unpaid','undergoing_provisioning') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'undergoing_provisioning',
  `cancellation_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancellation_reason` text COLLATE utf8mb4_unicode_ci,
  `cancellation_requested_at` timestamp NULL DEFAULT NULL,
  `cancellation_reviewed_by` bigint UNSIGNED DEFAULT NULL,
  `cancellation_reviewed_at` timestamp NULL DEFAULT NULL,
  `renews_on` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint UNSIGNED NOT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint UNSIGNED NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint UNSIGNED NOT NULL,
  `reserved_at` int UNSIGNED DEFAULT NULL,
  `available_at` int UNSIGNED NOT NULL,
  `created_at` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int UNSIGNED NOT NULL,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2026_03_10_031830_create_personal_access_tokens_table', 1),
(5, '2026_03_10_040100_create_services_table', 1),
(6, '2026_03_10_040200_create_service_configurations_table', 1),
(7, '2026_03_10_040300_create_service_addons_table', 1),
(8, '2026_03_10_040400_create_portal_orders_table', 1),
(9, '2026_03_10_040500_create_order_items_table', 1),
(10, '2026_03_10_040600_create_payments_table', 1),
(11, '2026_03_10_040700_create_customer_services_table', 1),
(12, '2026_03_10_040800_create_portal_notifications_table', 1),
(13, '2026_03_10_050900_add_profile_photo_url_to_users_table', 2),
(14, '2026_03_11_090000_add_two_factor_enabled_to_users_table', 3),
(15, '2026_03_11_090100_add_session_metadata_to_personal_access_tokens_table', 3),
(16, '2026_03_11_110000_add_address_and_mobile_number_to_users_table', 4),
(17, '2026_03_11_120000_create_profile_update_requests_table', 5),
(18, '2026_03_11_130000_add_internal_roles_and_enabled_flag_to_users_table', 6),
(19, '2026_03_11_140000_add_registration_approval_fields_to_users_table', 7),
(20, '2026_03_11_160000_add_tin_to_users_table', 8),
(21, '2026_03_11_160100_add_cancellation_fields_to_customer_services_table', 8),
(22, '2026_03_11_080000_add_pending_review_to_order_items_provisioning_status', 9);

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` bigint UNSIGNED NOT NULL,
  `portal_order_id` bigint UNSIGNED NOT NULL,
  `service_id` bigint UNSIGNED NOT NULL,
  `service_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `configuration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `addon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `billing_cycle` enum('monthly','yearly','one_time') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `provisioning_status` enum('active','expired','unpaid','undergoing_provisioning','pending_review') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'undergoing_provisioning',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` bigint UNSIGNED NOT NULL,
  `portal_order_id` bigint UNSIGNED NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `method` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('success','failed','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `transaction_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint UNSIGNED NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `location_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `ip_address`, `device_label`, `user_agent`, `location_label`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(29, 'App\\Models\\User', 2, 'Win32', '9db42acb3f6b7b7406bdba288b804d8c4fc991be72b360d46c71eaa1d5df2772', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 00:12:28', NULL, '2026-03-11 00:11:52', '2026-03-11 00:12:28'),
(31, 'App\\Models\\User', 2, 'Win32', '091c272e460b21c7590856df345ca426794bfde1c970fcbbd4f029edd5389b95', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 00:13:17', NULL, '2026-03-11 00:13:02', '2026-03-11 00:13:17'),
(33, 'App\\Models\\User', 2, 'Win32', '0ce3de73293d6383e59c52a8f27dcf160920ee4e083645f56f3e52145c72c1ff', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 00:21:23', NULL, '2026-03-11 00:21:21', '2026-03-11 00:21:23'),
(35, 'App\\Models\\User', 2, 'Win32', 'c95d0f66145c6b0434248e85db98bdf95e8dccb56cb97411c5160fe243557b68', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 00:26:24', NULL, '2026-03-11 00:26:23', '2026-03-11 00:26:24'),
(37, 'App\\Models\\User', 2, 'Win32', '2afffc5614f497275233ece9dfcca67b3ff6284f37a8f8dd5b477f92eb01c27f', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 00:31:03', NULL, '2026-03-11 00:30:32', '2026-03-11 00:31:03'),
(39, 'App\\Models\\User', 2, 'Win32', '212774c89723f14608a9258bad1ae137406f920d00f1184fbbe014321e6636bc', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 00:44:52', NULL, '2026-03-11 00:33:17', '2026-03-11 00:44:52'),
(41, 'App\\Models\\User', 2, 'Win32', '1b948b42f795ec0e816be578c4a3db3689b80c069d90d7d19bfa656901ec8756', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:02:21', NULL, '2026-03-11 17:02:19', '2026-03-11 17:02:21'),
(42, 'App\\Models\\User', 2, 'Win32', 'ff5f74b032ebd78f6dfdf5ce5c7d8eeb29549d9a3671aab7b3ce651d3f0a67c7', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:10:29', NULL, '2026-03-11 17:09:40', '2026-03-11 17:10:29'),
(44, 'App\\Models\\User', 2, 'Win32', '0133670701408ce3e0b8fa0a682fae533952b6122e586a731eb6e286fc83ef58', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:13:30', NULL, '2026-03-11 17:13:29', '2026-03-11 17:13:30'),
(46, 'App\\Models\\User', 2, 'Win32', 'bfc63d4a7bbfecf69bdf83c5b755536a615ec3fba21e9e7c7be6b0079ed81921', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:17:11', NULL, '2026-03-11 17:17:09', '2026-03-11 17:17:11'),
(48, 'App\\Models\\User', 2, 'Win32', '7b3d1b73b24152bd40e2fba55e794b87d1ca24eb6463e743fd445454704dee6e', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:23:38', NULL, '2026-03-11 17:23:29', '2026-03-11 17:23:38'),
(49, 'App\\Models\\User', 2, 'Win32', '1bf41ef7d9e0eca0d7cc2e0151c17263ba6a9d6fdf5ba1fe56edf035d0b7648d', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:24:01', NULL, '2026-03-11 17:23:59', '2026-03-11 17:24:01'),
(51, 'App\\Models\\User', 2, 'Win32', '9b623e81049d5c4fc6c687eea293cb0f43ffdb1a96371aa112744b440b53d95d', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:27:48', NULL, '2026-03-11 17:27:34', '2026-03-11 17:27:48'),
(53, 'App\\Models\\User', 2, 'Win32', '8072a57a88523d45ed8034b8a0cee3d575f170c7e6260238f135ba4f8650db62', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:30:00', NULL, '2026-03-11 17:29:43', '2026-03-11 17:30:00'),
(54, 'App\\Models\\User', 2, 'Win32', '9da138c0427ce94f33ede8724d8abd52f41a13fb30831662d3b2b97110e86aab', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:30:15', NULL, '2026-03-11 17:30:14', '2026-03-11 17:30:15'),
(56, 'App\\Models\\User', 2, 'Win32', '55e039251aaf252a5804a813bb5ec3df41e3025da38bade9609ee617e6642661', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:34:05', NULL, '2026-03-11 17:33:59', '2026-03-11 17:34:05'),
(58, 'App\\Models\\User', 2, 'Win32', '176f35ad591a4307cd766405eb5e7d2166128642d7316dff689b8aa352a92d18', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 17:36:22', NULL, '2026-03-11 17:36:15', '2026-03-11 17:36:22'),
(60, 'App\\Models\\User', 2, 'Win32', 'e04c4514231ec448ef3605c54bf17d4d4a8715e3e127209eafed770c05fd98d1', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 18:28:50', NULL, '2026-03-11 18:28:30', '2026-03-11 18:28:50'),
(61, 'App\\Models\\User', 2, 'Win32', 'cd339f6415eb3d01c6054655b7835d876a16d80ba9cf3811f748f358ad30451b', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 18:29:03', NULL, '2026-03-11 18:29:02', '2026-03-11 18:29:03'),
(63, 'App\\Models\\User', 2, 'Win32', '28912e3521f7dd105edd327505d54cd33f68baacb5841e2407e8b8e0562953fd', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:25:45', NULL, '2026-03-11 21:25:37', '2026-03-11 21:25:45'),
(65, 'App\\Models\\User', 2, 'Win32', '7c6adcb91fcc14ae02c864d12b3bdaea9c048ca4d62a531e6ac2c530f544899d', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:31:38', NULL, '2026-03-11 21:31:31', '2026-03-11 21:31:38'),
(67, 'App\\Models\\User', 2, 'Win32', '55337c37fa80b67114e71887cc8f3b1c5f3afe3fafda750d855278531183c404', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:32:20', NULL, '2026-03-11 21:32:11', '2026-03-11 21:32:20'),
(69, 'App\\Models\\User', 2, 'Win32', '10d3a7799ed28aa4597c5605758860446ba5f3fe26b5e507b43ae3dd59af42fa', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:40:09', NULL, '2026-03-11 21:39:41', '2026-03-11 21:40:09'),
(71, 'App\\Models\\User', 2, 'Win32', '92e227f23c61457ee5941593d33eaba36b9e9afbd05b71afa7ef17ce9b5f803b', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:40:50', NULL, '2026-03-11 21:40:44', '2026-03-11 21:40:50'),
(73, 'App\\Models\\User', 2, 'Win32', 'f2274e8363a9de14f239fd3188c63ef5c4edfe224cf206e45ccfda8cdeb6db0b', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:46:57', NULL, '2026-03-11 21:46:46', '2026-03-11 21:46:57'),
(74, 'App\\Models\\User', 2, 'Win32', 'f2ef4ed23f8528aedcd69ddefbd4b030464b4215524987f36248a0de63c37af7', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:47:06', NULL, '2026-03-11 21:47:04', '2026-03-11 21:47:06'),
(77, 'App\\Models\\User', 2, 'Win32', '51d79d2d7f61c7f8f76fded853fedb75b8ee83367b5509cf3e829ecf43f756c8', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 21:55:18', NULL, '2026-03-11 21:55:00', '2026-03-11 21:55:18'),
(79, 'App\\Models\\User', 2, 'Win32', 'c87fa5e0d49fab8f26910a035e1383f06b3a910041d500a3ee3fbda4a76b241e', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 22:02:30', NULL, '2026-03-11 22:02:13', '2026-03-11 22:02:30'),
(82, 'App\\Models\\User', 2, 'Win32', 'a5900ea0756dade80e2429a825101bb8825823fcfa2d51a0de53bc03b037390a', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 22:03:29', NULL, '2026-03-11 22:03:21', '2026-03-11 22:03:29'),
(84, 'App\\Models\\User', 2, 'Win32', 'ab3bd374d68487bcac9d6be8daec471f9a89c57b193d110044df821e73f83c90', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 23:10:34', NULL, '2026-03-11 23:10:06', '2026-03-11 23:10:34'),
(86, 'App\\Models\\User', 2, 'Win32', 'db8d87148e157fce0f0ebd2c6d90368c4acddcd8c703e24eb0a60225e246bd59', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-11 23:37:08', NULL, '2026-03-11 23:34:10', '2026-03-11 23:37:08'),
(89, 'App\\Models\\User', 2, 'Win32', '1118e5c63383ee5807cb4952792e2b60c4dcec7ea7415b8c8cebd5d16f052005', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 00:11:16', NULL, '2026-03-12 00:10:37', '2026-03-12 00:11:16'),
(92, 'App\\Models\\User', 2, 'Win32', '383bccab93176a227e86e1658346a7312d6e3787c78540b4b8bb18096508d9c5', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 00:24:13', NULL, '2026-03-12 00:24:11', '2026-03-12 00:24:13'),
(94, 'App\\Models\\User', 2, 'Win32', '8f48650c37d748792b2891768c0be171e9def91ebb6196a55f5ac9498a64e906', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 00:27:41', NULL, '2026-03-12 00:27:25', '2026-03-12 00:27:41'),
(96, 'App\\Models\\User', 2, 'Win32', '40ff39a476b2a4ee73eb1f6835afae9c12d35c8c5d5f5c5c76813f02bac0e179', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 00:31:30', NULL, '2026-03-12 00:30:57', '2026-03-12 00:31:30'),
(98, 'App\\Models\\User', 2, 'Win32', '64d5abab79dc3c305e5cc2afaf789da06c8ce4aa66ec66f549080dcbd563013a', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 00:37:25', NULL, '2026-03-12 00:37:23', '2026-03-12 00:37:25'),
(100, 'App\\Models\\User', 2, 'Win32', 'daf342787cbfd42debc6a20374c5a70911e718ebd31bd3160f8c91039d791031', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 00:41:00', NULL, '2026-03-12 00:40:18', '2026-03-12 00:41:00'),
(102, 'App\\Models\\User', 2, 'Win32', '2d2ea8ed1c8ee2314598297cdf592a9b7248625f967917cbea3273b9986ce146', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 00:47:40', NULL, '2026-03-12 00:47:23', '2026-03-12 00:47:40'),
(104, 'App\\Models\\User', 2, 'Win32', 'a9ce157188a3b86fdd0e8ff66550d39369e86b7094af198a681889fd3b8e7aec', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 17:48:58', NULL, '2026-03-12 17:48:19', '2026-03-12 17:48:58'),
(106, 'App\\Models\\User', 2, 'Win32', '707623b87fe5d269ba6d041021f64983d32fdbf078af427b89b401e889204640', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:09:15', NULL, '2026-03-12 18:08:58', '2026-03-12 18:09:15'),
(108, 'App\\Models\\User', 2, 'Win32', '3028ca1a5a8c369c8362f99cd6f8e605136965f428ed956e2e5611e10181c9df', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:16:05', NULL, '2026-03-12 18:15:52', '2026-03-12 18:16:05'),
(110, 'App\\Models\\User', 2, 'Win32', 'aced6132e867e8a95a7d9594c2a414496c7acc294f3450ae6af5e22d21c5818c', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:18:06', NULL, '2026-03-12 18:17:43', '2026-03-12 18:18:06'),
(112, 'App\\Models\\User', 2, 'Win32', '548774a8fc78e84f7fdb962ecdd10e0f73a8a51def3ab3ff027bb77f13d747c4', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:24:45', NULL, '2026-03-12 18:24:35', '2026-03-12 18:24:45'),
(115, 'App\\Models\\User', 2, 'Win32', '4e69fa039feacb51f73fbaeaceb90a597140ac7a172f43a8f526ec4bd836d910', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:27:06', NULL, '2026-03-12 18:26:59', '2026-03-12 18:27:06'),
(117, 'App\\Models\\User', 2, 'Win32', '30242644c65c62e9b5aeac0ecbaa64c7d9bbc5a5140cd178fe8789d76e77bb2d', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:35:03', NULL, '2026-03-12 18:34:56', '2026-03-12 18:35:03'),
(121, 'App\\Models\\User', 2, 'Win32', '1aed295e346dfa8e0227c343e688e5ed80f22e3a220fff8b5a13529a13d3fced', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:56:52', NULL, '2026-03-12 18:49:25', '2026-03-12 18:56:52'),
(123, 'App\\Models\\User', 2, 'Win32', '00da28ee2d7f1d9798e54eb7fec43b298cbb1fb51cde886082f4e7e72d66c349', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 18:58:33', NULL, '2026-03-12 18:58:15', '2026-03-12 18:58:33'),
(125, 'App\\Models\\User', 2, 'Win32', 'fdb5a454c4bdcce95da690e1d7c80e4c0fdf45b9e2f43aa9e13afe1f24e56e70', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 19:17:44', NULL, '2026-03-12 19:16:16', '2026-03-12 19:17:44'),
(127, 'App\\Models\\User', 2, 'Win32', '64d41dd751e36c0409dd84c3f02a0d7b644e74841e2608c4815dcb672442a908', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 19:19:55', NULL, '2026-03-12 19:19:26', '2026-03-12 19:19:55'),
(129, 'App\\Models\\User', 2, 'Win32', '398d98671856f2d83bc1e14d938cf11376404226ca5181b98db25d06e2f218fa', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 19:21:01', NULL, '2026-03-12 19:20:52', '2026-03-12 19:21:01'),
(131, 'App\\Models\\User', 2, 'Win32', '739cf906469d335f630d6e8a320859baa1ce8acfd807f887c38a265f0afbcff7', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 19:22:07', NULL, '2026-03-12 19:21:51', '2026-03-12 19:22:07'),
(133, 'App\\Models\\User', 2, 'Win32', '01ed33796ab1e08e2e140607e031edbf1257f40294e87f77b65c94a888c80960', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 19:23:08', NULL, '2026-03-12 19:22:49', '2026-03-12 19:23:08'),
(135, 'App\\Models\\User', 2, 'Win32', '2755584e7d4a08bf79ff684b596b6d325ca1a9511e673f70cfe91355925f4ff3', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 19:23:47', NULL, '2026-03-12 19:23:36', '2026-03-12 19:23:47'),
(137, 'App\\Models\\User', 2, 'Win32', 'edad751f77b694267e4f71a44ee8bc28b42ea0f328abbc99556ae789f1dc351c', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 21:03:41', NULL, '2026-03-12 21:03:39', '2026-03-12 21:03:41'),
(138, 'App\\Models\\User', 2, 'Win32', '751340546f882b0a0d9b73bb31d3298e4a50a5e52d0a441bacc8aee09c6b621b', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 21:04:17', NULL, '2026-03-12 21:04:02', '2026-03-12 21:04:17'),
(140, 'App\\Models\\User', 2, 'Win32', 'e356947b911ee07def8bcd2766a6e1813e79ac72acc4b4e3b581599830f315b2', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 22:15:11', NULL, '2026-03-12 22:14:26', '2026-03-12 22:15:11'),
(142, 'App\\Models\\User', 2, 'Win32', 'b43b43a0c9e68c818e346015c1aaabe3ccde4eb240e0c73878ed7fba145f97c1', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 22:17:35', NULL, '2026-03-12 22:17:24', '2026-03-12 22:17:35'),
(144, 'App\\Models\\User', 2, 'Win32', 'b1f403ba7018ad9c1ff01b7ee6b04900df33bee3bed34aeb97842fbe6e6d7630', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 22:21:46', NULL, '2026-03-12 22:21:14', '2026-03-12 22:21:46'),
(145, 'App\\Models\\User', 1, 'Win32', '8a1e3d61ffe0533c1cff741ceb40b367c05b231a89c11f05eaf9d13efa62884d', '127.0.0.1', 'Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'Asia/Singapore', '[\"*\"]', '2026-03-12 22:26:43', NULL, '2026-03-12 22:21:50', '2026-03-12 22:26:43');

-- --------------------------------------------------------

--
-- Table structure for table `portal_notifications`
--

CREATE TABLE `portal_notifications` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('info','warning','success','danger') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `portal_notifications`
--

INSERT INTO `portal_notifications` (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at`, `updated_at`) VALUES
(304, 2, 'Profile update approval needed', 'Jamal Saberola submitted a profile update request for approval.', 'warning', 0, '2026-03-12 18:57:59', '2026-03-12 18:57:59'),
(307, 2, 'New customer order submitted', 'John Doe submitted 1 new order(s) requiring review.', 'info', 0, '2026-03-12 18:59:23', '2026-03-12 18:59:23'),
(309, 2, 'Payment proof submitted', 'John Doe uploaded proof for order WSI-702775. Please review and accept.', 'info', 0, '2026-03-12 18:59:50', '2026-03-12 18:59:50'),
(311, 2, 'Payment proof submitted', 'John Doe uploaded proof for order WSI-702775. Please review and accept.', 'info', 0, '2026-03-12 19:14:02', '2026-03-12 19:14:02'),
(313, 2, 'Payment proof submitted', 'John Doe uploaded proof for order WSI-702775. Please review and accept.', 'info', 0, '2026-03-12 19:15:36', '2026-03-12 19:15:36'),
(317, 2, 'New customer order submitted', 'John Doe submitted 1 new order(s) requiring review.', 'info', 0, '2026-03-12 19:20:38', '2026-03-12 19:20:38'),
(321, 2, 'New customer order submitted', 'John Doe submitted 1 new order(s) requiring review.', 'info', 0, '2026-03-12 19:22:21', '2026-03-12 19:22:21'),
(325, 2, 'Cancellation request submitted', 'John Doe requested cancellation for \"Top Level Domains\"', 'info', 0, '2026-03-12 19:23:23', '2026-03-12 19:23:23'),
(327, 2, 'New customer registration pending', 'Jay Anthony Saberola Jay Anthony Saberola submitted a new portal registration and is waiting for approval.', 'warning', 0, '2026-03-12 21:03:20', '2026-03-12 21:03:20'),
(329, 2, 'New customer registration pending', 'Google Demo User submitted a new portal registration and is waiting for approval.', 'warning', 0, '2026-03-12 21:22:45', '2026-03-12 21:22:45'),
(330, 2, 'New customer registration pending', 'Google Demo User submitted a new portal registration and is waiting for approval.', 'warning', 0, '2026-03-12 21:22:46', '2026-03-12 21:22:46'),
(331, 2, 'New customer registration pending', 'Google Demo User submitted a new portal registration and is waiting for approval.', 'warning', 0, '2026-03-12 21:23:02', '2026-03-12 21:23:02'),
(333, 2, 'New customer order submitted', 'John Doe submitted 1 new order(s) requiring review.', 'info', 0, '2026-03-12 22:14:10', '2026-03-12 22:14:10'),
(336, 2, 'New customer order submitted', 'John Doe submitted 2 new order(s) requiring review.', 'info', 0, '2026-03-12 22:17:07', '2026-03-12 22:17:07');

-- --------------------------------------------------------

--
-- Table structure for table `portal_orders`
--

CREATE TABLE `portal_orders` (
  `id` bigint UNSIGNED NOT NULL,
  `order_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agreement_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `terms_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `privacy_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('paid','failed','pending_review') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'paid',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `profile_update_requests`
--

CREATE TABLE `profile_update_requests` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `reviewed_by` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_number` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_photo_url` longtext COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `profile_update_requests`
--

INSERT INTO `profile_update_requests` (`id`, `user_id`, `reviewed_by`, `name`, `email`, `company`, `address`, `mobile_number`, `profile_photo_url`, `status`, `admin_notes`, `reviewed_at`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 'Jamal Saberola', 'customer@wsiportal.com', 'WSI Demo Client', 'Davao City, Davao del Sur, Philippines', '+63 912 345 6789', 'data:image/jpeg;base64,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', 'approved', NULL, '2026-03-11 00:13:16', '2026-03-11 00:12:53', '2026-03-11 00:13:16'),
(2, 1, 2, 'Jay Saberola', 'customer@wsiportal.com', 'WSI Demo Client', 'Davao City, Davao del Sur, Philippines', '+63 912 345 6789', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCAC1AQADASIAAhEBAxEB/8QAHAAAAQQDAQAAAAAAAAAAAAAABQMEBgcAAQII/8QAQxAAAQMDAwEFBAkCBQMCBwAAAQIDBAAFEQYSITEHE0FRYSJxgZEUFSMyQlKhscHR8CQzYnLhCEOSFoIXNGNzotLx/8QAGgEAAwEBAQEAAAAAAAAAAAAAAgMEBQEABv/EADERAAICAQQBAwIFAwQDAAAAAAECAAMRBBIhMRMiQVEFcSMyYYGhFJGxBiUz0ULB8P/aAAwDAQACEQMRAD8Ao2DH7z7Q0XioBd2HkCtMxwzF8qaJmFL2xJ9o8Csxm3T6ABa+5OdPRGHpKVvDawjlX+rHRNDdca0XOWIUQ4YZ9kBPRR/pSWJYt4ZQ4WypOSfIeJoSm3tqdC1D2Pw1MiqH3NLbHc1hE94PtGm5mop6GgkkuKxirxsenrXoS1ENoH0heApauqlenpTPQtjbtcFVykpCFKGU5/CiiFltkvtF1IY7G5uAzy87n7iPIepqTU6hrTtH5RLNLpqtJX5X/MYS0fp+VqmcbjMJRBaVucdP/cx4A+VSW12yNra9SrrMWPquCvummk8b8fxTDVeoAp9jRGlkjajDb6mj0805/UmpTY7a1p+1JtbKgteQt5zwK8eFRWekZMRbe9g39E8D7e5hhcovpQ02hLUdsYQ2PDypRsYpohYSP5ovAtxWA69kDH3T41KfVM60isfAmmY7jxHdpGPFSvCnqIseKO8dVlXgVf0pJ+5NsnumNvHj4CgUm7qiSZLs9TbUNKQW3VK5J8Riubgv3kqpZb1Dz1x4+xBz03E/xUH132jsaXtrr4cblSgsNojJdCSSfE45wMGoj2h9uFt02lMezkTJi1EPpOU90nBAIPnnFUTbFTrpIdnSVjIJcWpXJ+NXafRuw328D4HvLtFoBdZ4+gOyfaWxB7atRLuLhXZorsVxP+W0VDaRnBCjnJJI6gDrT7T/AGn3+3pcRqO0rlNLc3JeZSErQk+BT0Vj0xVP27W7jsxyKhTbLClbW3VnG0DqSB1pw3r7fMnNy5T5jIP+HdSFe0Bxgj1qx9G56QAfzNP/AGtCB5Sfk9Dj9pcmiO1GHe9SS7U8H4yZTpMFUlfLh8UY8OnAqyG4ql73EZcTuIykAgEHkZHiK8dParjzm0vP7m5CFgpUgkLQfA5HjTvS/ajqLR8kRoN0kJta3+9cZCs71HqcnkZ4rjfTC43AYPxI9UyI26hwyn9iPvPWiWnG1LKh3Yzxt6139auxErLitwT038Z91R/QPaTD1Db2n5LgeZWcOFXKmz6+lFtTiNJcSzAWcrHnkVmLQ2cRN9vjP4i8Hr4kP1Xel6hd+gsjBUcGt6f7G2GUfSpDaJCnOVIX61ILXpJy2Mqfej71r9oHwz1+HNGrJNmsRGlyUpQpQ9poHITzxg+6nPqGUbAYkU8b0MgF/wCy5ltC3rQnul/ijK+6f9pPT3GgOm9RXbRM9ZjghG/7WK7nCvh4H1q+QiNdEcKw4OfUf8VEtV6NYuyVBbYakp/ynh+L3+YpYuPRM0dNra3HhvEeOosPanZ97JDM1sfe/wC4yfI+af0qndQ6eVaH3rReo5LKicH0/Mn+aeQXpektQIVJU6yG1DeEKI3p/keNWjcoNv15ZURHVJ74p3RpQ6g46H+lNWwqQRO2Uf0p253Vn+P1nlhb83Rt8PdPd6lDmAv86eufiKtNRZ1ZYm5cYZfQnIPp4iodrXTUiBKkQprSmZDJwoY49CPQ037OdSKtFzNvkLPdunCc+Bq6xfIm9exD07+F9mcqYqtZSs87cc7fWp/pS5t3u2OQZZ7x1I2rB/Enz/io1q21Ji3Hv2E/YyBuA8ArxFMrPcHbRPZloyQDtcT5ip3UWJn3l6eh8DqDNWWJywXJbKk/ZrJU0rzFAgrBq4da2VF/sJkRzveZT3zR/MMcj5VTKiQSD4dc06iwuuD7RF6hW4iE9fdx8Cu9DWH63uZkvA9y1k5xwBTS8uEAITyT4CpbCIsulW2GBiVNOPVKfGtB22p6ZkVILLju6E2txd1kyGIjSSZCgyzuO0JSnlRPy/etaXsn1veRHUrfHa+0cX/pB/mtNgW+0OPJOHX0mOzjwSPvK+J4qb6OgCy6cenqbIKkl1RxyEgeyP786gdygOPeayIGcFvadanlvSXI1ityN0mSpLYSnxz0SKlupblG7ItFR7Jb1JXe5wJU4kZIOPaWf2Hupj2VW+Og3HX17IbYY3dxv6DzIz4+Aodo6LK7QNaTNa3lo/QYzn+EZV0WsfcSPRPU+tIGF+w/zM7U3m63b/4iSfQGllaYtYlzxm7zxvdKurST0H+49TUjExkPdzvQHMbtm4bse7rVe637RJkW5OWq0FK5G7a4/wBSFn8Kfn1qU6CsC7dDL8xxTsp4hx91w5UpXlnyFIsrJ9TdRgKqOZMraxtAkv49nlKT0A8zW595732Givu/Tqf+KGTLgHSWm1Hux1KfE1u3oSttcia6hlhgFTizwCPKpj3iTmgf8lkXkTGoUdc97IbaGArzPkPOqq1nrNuOp2RJVvDKC73Z6IH4Rjzz5067TO0yKmIW4ZBZR7LKB+I+H9TVFalu78iGppbu96Se9cPmByB8cfpVui0LWHceo9bhQhIHrP8AA/7gO53KRPnuy3/bcWsqUT60Vs0a43U9yzluOsncQOuEnim+lrWi/XURnAEJGSpRPjViMS7fpqEmE2hLrzKCrcPE7uf0ravtCDao5Elpqe0kE+gfyYlb+yB+bFbUnahxKUuK455zj9qk7PY+0llp52KRlGVlPIV51Nlavt0IMOBTIQpCGlgEdMYz8yP1povtMhtQ22nHUkJUUK/v3YNYj6rWWH0y86RAPQo/eVtc+xuOy+42VOJIQXGztySnyNVhqXSrlsfBbK3Gjzvxj++eK9B3rtGiXBr2UID0ZIUDn76Dwfkah7l5tlxtU9pbSCtp/v0EjkoV94fPcav01+oH5+Ym36fU6+wMq3SWqbnpe4ByMpXdEYdbUfZUM/vXo3sr7QbPebm3EnyAwXR/h1OqAAP5CT8wfhVG3axtBLki3PLSdneJKVYPu+VALVekh7uLgFrbzhWFYWD5g1VbUt3rAwZGVdajRYcj/H2nvtLipEsNNKT3bA+044USOB/PyptcLGlxClRhgkcozx8K8gWPtE1NpVxaLDeX3oKeQ1nITnrlJyM+uKsvSP8A1K3B95Me7pjLKuM93sUD88Gs63QMASZIqPWwKH/oy2kurhuJGFpcB29P39KOR32rswWnhtdSOg6+8VFW9dWa+JQVr+jSFDjf7IWP93T9aXjTwt09w62C30A659ay2UocS96WdcsMNGWstJIusYtqAEhAPcvbevofSq+0rqJ/TF0Va7nubYWvadx/yVZ6+41dneIvEQpVhLiec+RqDam0VAvzilyAtiUBsU634+8eNGp4wZVpNTuU1Wxj2r21i86Z+tFpAnQSlKljq40Tjn3E15mvi1QZwfaVtKVZBzivQrka7WhTenrlLak2q5NORGpCxhTLhSdoJ9+2qE13Afgvvx5LZS8ysocGMYUK1tAMnBiLvTUQPbkSxNOXtrWGmVRzn6Y0nvE+JyOv80LbVuScfl6etRDsnvi7fqBEdatzb2U4+BqbXdkQby+ykYQs94j3H+hzXbatlhX5l2m1PmoD+4kz0XcRKt6oTpClx+OT1QelVZrO2Gy6hlRkg90Vd43x+E8j+alumrh9X3ZlRUO7c+zX656frSPa3CBTDuSRyctLP6ipqfRbj5lduLKt3xIAYokym1kZTlPNSL6SXwotBJVxGa9PAmhk0i321CyMLI3fHwojpXDtwhNr5DY3qHmfOtC38uZjUNizHzHAjJut9i21r/IjgIOPyp5UfnmrD11K+gWK2aeZWlp64qC3j02tj+P6VHOz+0Nyr/Ic6oU+pIz+QHKvn0qMdpmo/rvVU15C1FptRYaxxhKOOPec/OpAnksC/Equswufn/1LOsjbfaZcE6dhurjaRsLaS8UcGWsdSfec0V1drW36Vji1W5gfSUI2sR2x7LQPAz5/80v2bW5vSHZk088e7en7pT58dmOB8qjmjmvraRcdRTGkOOyXiGdw5Qkdcft8KS2C5+BI6iACYP0HpObJuiblcmVJKiVthz7xUeqiPSrSudybgx0R2SlGRtyTjaPP30yt60tpclK53ZSDjwHU/wB+VRy/vxLgzJcuJT9HA3qycbAOhrjAuRBNuDDCp0eAlyXLlhiI0nc8tfRI9PMnyqs9bdq7uowm2QEmNbgvCG88uYPVXpUP1TrB3Ucrug4pq1Rz7DWTheOhPmf2qI/WCnBLuBThKE922PImrqNCo5aA+r3MB8QtLnqvNwXtUfosUY3dd5/5/ipzdezZizdltxv94dQ1d5K2lMNuEA47xP2SR57SoqPpj8NJdj2hHb3PhpXwwyRLkrIzgfhT7+Klf/Uld4jlvhWOOGu8hK+krBHKRgI48sb0/BVMa3FgrSeNTtz79mVDppvuErdSsBwrSncfP1oo3p+8PakjWqS0puS8taBu6EbSoEHxBFBLDISxIgpcQ26336CttadyVgq5B+delZNhYd1Ba5SGilEVhS0lOMI25AB9MK/Smal/HZjHc7pfUn2lA3xc2AuQELWttSQ6k5OEkDCk+/oaDWyW/c5rjQcO51OU8nGatO0/RtRLk2x2C5uZWcrLeUKznBCh5jI5oCvs8+otWRI0JuQ6G965DpOUNZxtQPcOtMrsUptI5jtRVYWBzIc1IkOKS04VZS53ayD0CjTdM9+GpSFlXBUhXrg1cdv7PNMP22XInd4m4vgFLmFEIWFZBCeg8qrDtFtrFuuE1cJkNRlS1hoAYAASngCmVXq7suMY/mS2C1eT1GltvGClhZ9knYSas/RnZPpvtA0C4H0Kh3RMxxtqawNymzjgOD8h/mqQdfU2gqA2kFJPofGro7AtSQLY9eHLpcGosUIQ6C88W2wo9SRkBRIwB7jQ6utlTfX2IhbBZ+G0ry79nt60RqRFpvochtqO5qY0N7byPzp8xyMp6/y+u9klqiB9FoflojKLcmZGRvbx+FXHgRzmrp1rqfsw1VbPq+VeYrq4oWqJ3SnGg24oclJAAIJ6jxx50Q0e0vsjuv0Oc63N05fChTFxAz3LmOEueGCD97x6++E6piA7DB/gytbGqpZRzn5/+4nn6y6puFoR/hZP0mKP+y6cge7xFTJjtBZfbS5BkvW+YnJ256+7wUP1q+tYdlWgtRJVKudtYhvr5EuGruXFE9OU/e9xBrzd2ndl1y0Gszkh6bYnVHupSkgPN/8A3UDkdeFcA45AoVNGob1DDTtP1K1KyB0fY8/2MsHS/b4i1zG4+omCls+yZbHIPqpP9KtsXK3ahtzd2tM1iWyof5jSsj4+RHka8RGaHmwjvA6nwOaNaT1bf9GTDPsctxPi9FOVNOp8QtHljxFHf9MG30mSrrM2Bp6o1Ba273bH4isoUsZbWOqFjlJHxqje16IblZ41/UjZJyYk9I8HkdFH3irM0T2qWnWFvCkEsT2x9rGJzg+aT+IftUD7U5bTTtwjJbUI1za3EKPCXk/i95FS6RHrt2sJfqirVbhKX03PVbb5Fkpz9m6FHHlnmrY1NOD4jzhgFJKCf9J6VSsaSWXxswTnAqVJut4n2xOVexjAH+3p+1bN9O47pnaTU7FKiTVEkbQtKsFPOR50f1bJ+ttJuk+0pCA4n3jr+9U7E1Hcorza3FAozgg+NWRYrp9Z2ZxkY9tKk4J8xUdun2kGaVGt3grAWv3ERY8RtB6nkeg/sVmlZ6U99I3coaOP4oNrqY1KmpW26HEpRgBJ8T1/YU10ZdGWri0xKwGHFBLnqKparNUzjfi+XTpWT9Q6cuV0OA5GiK2Z8VqB/nFVVaIzt+1FBt6SVKkSUNk+eTzU47QNUNGx/VUJttuO4pJJSeSAAf6UI7EIf07tDhuqSCmOlb5J8CBj96krXajORzK7rdxCjqXJ2vTzZ7Im3RxsStpEdkJ/L/YxTK1tC22mHDbHKG0JOPxK4/k0I7Ubl9aaytcAKy22oKI91Fre8lcxlJPCTuIP6VKtfp+8Q1uOBDd0kIh27uAsD8HXHA6mqH7S9Zi8SharevbFRw6sH/NP/wCoqc6t1Ab0t1ph7urTESfpUoHhw+LaD49OTVFXO5JdkOyUt7As+wjptT4AVdo9OM5aSWWYE3cZqUt92CcJACQP1rthh6YiLDZSV7lF1aR5DnJ+FB0Idf3Orz94I58znj5A/pVqaE07nR+p9SPDAQ03bo5P5lkbyPgQPjV9zCtcwaSWYiXl2QW9Fl0OLm62A7MO9IJxuSOEJ/SvP2u7xe77dL09d4SI0pTuxbSSQoJSMjjxBATz6Va/aZrx7Qrdg0/DtTj0JlplUqUQtKGOgB3DgHqaWvNmgaxvDa5kdMiOYq/tGxsK0HAbznGepPxrHr/DPkPv1NrTN5HfPHB/xx/iefIMpLbjTntHuwlzGfIjj9K9GaV1Gbk2zPSVONvoC05PQeKcV5oU0qJLdirOFsqcYOfNKiKtjsh1iJrEayiOsPRUJR7Kc7xk4+NaerTcofEj0NoVipMty16bkNXwyWEhEFZ732U4KVYOB88Vka1d8C44nCu8cJV5+0R/Aqc2B9LkAFxsoV0KSMEEcHIqOXyHdk3h9mBKhx4jiA6ne0VLHgrHOOoHzqRAJVZeztiC3rOk8FIBJ6VT/a7bmWtSWOAraW9q5EhA8U7kk/Hak/OrR1frK0dm9lFxvEh2dKXw0zkb3leWBwlNQBLTeqLorUE0b1yoykpSeiEq24wPA8K92QPCm/kO6T6jUnb4/eU7eGXC6ZS2i2iWXXcY4TlR4+FSfsjtFtv96LFzZL7LbSSlAOApRVtGcdeVCj2ptIqlCDHjq2xm9ySjGSEJbJKs/L5UM7Fv8Ldp7yASG4/GOow4lXw+7TrLd9LETPr9Ngluau7H7Rf2obsKGi1uRn0OKDACe8a43oIHU8HHr76Zdjevk6ouN+0JNtLjEFla129p9BUGEZx3S8/MZ8zVkNIaeO9TQGQAAD0/viq07VYeqUXO1StHPNsud+VSWUuttKklBGCokgq8qyan8oNbftNPVV+kWCWFY739V3lGkLk4Wu+QXbTKWASAMhTRz+JPT1GKm6bVDEd5l5pElL6Sl3vxvLicYIOfD06VTPajLXf9LNzYLKjd4YRcmu6PLKgMOpyPcT8qLaI7QrnqnTqbo7KQlcdCRISkZPThXx/cGkvScb14Iku0twOpSnb12QI0FdTd7CHDZ5RyWxyYiien+0+FVjb79KgyG3g4pDjWCh1PBHPHvr26iJE1nZX25oMiLMSppxDicceleNdb6Uf0XqqdY3/aSwsllZHC2z901r6HVeUeNu5JbSazmT6wsW/WDIvdgCLbqOIQZcRkhLUkc4dbH4ec5SOM+WeUe0a5SbrakKmI7mUwQVJHAV6j1qutO3qTpq8xrjGVjuVDI/OnxSfQ1P8AVmq7ZeS1FdGGJadzbuPabUfP9jXXqK2AjkS2m1HrKN3IijSDzth+v45C2ELCXE45bzwP1qQ6eQyu2OtK2+wcc+oqy9HaGDfZTeo6lB9+RBW6kNnIynKs/wD4iqct8tEGG8+4okkjakeJry3eUkD5ikr8X5oLugS28tsAeyupBoqQ805tJO0+FR4IVMlF5xBSpZ+7U0skJMdpCsDNNuIC4nqVJfcJCRBckOdMc4+VEbZphUl8AdUgqyKJMxVIUolPQk/OjmnZKGX3CQDtRihssIHpixUM5MhF5bmQ3Q0t5StueCePKj3ZZrlnSV5ely2FLC2thKeSOQf4ppq8pcnqyOAATWtLadF1jTTtwpG3BHQUTFTVhxBO4NwZNHdXQL9rNu4993bfdlSd/GD5e+pPBU/qJ1YU45GtpT7QQcOSOemeqU8c+J9Koi4x5NneQtJI2q4OKnGlu0JTFukLfISvYMKP8Dx69KVZQMDbA8hzzH3a1qCPBiosMLu2kqUCtLY9lDaeAnHkT/NQiTY12DT7d7uqCmXcMpgRFdUo8XVeXkkeuaPacsKbldjedRPbpEhRdZjOdTz95Q+HShev7o7qC9NyCMp/+XjIx0Qg4/U0ykhfwx98ztgOMmNLjATa7RpuKpIL0lDtxdUP9a9iB/4tZ/8AdXoGy6b7rsJgwkg97OU3Lcx0y44FD9No+FUb2hrA1PGhtoUyiFAjxUoWOQEp6/rXplx5tnQjLSB7EeE0UJH+lCam19hCJ+sp0dQYtAF5nDU7CtMTNO3WQ3LKX5Sy60na2k4ynKwQNyccjpnii6ZdstkF+W5vZac2pZdeRkbU9MYHn09MVVz/AGkwL3c12VNsfiKuTqGy+T7am93IHoRnn1q7NNiKu4oDgT3MZJcSj8JKcAcfHPwqG2s5VWGJoVMFVivJnmvX1qYXKuV0hRXGQqT9JTvGDg/f+ZOR7qjemb3J0ze/rKG6+hwJCkd2ByfXP4fdzzXq3tAvtuTFlmcG1suN7FBQzkjOP3Pzqk9OaRt8txZKFtCUvKUpV7SEE/dB8M1o/wBUiIQ4kw0LOQyGTfs47c4dwkyW766W1KO5vBwNxz4j1FcdoPa59Szo0mEwJTamS2XElK9qjg9Mjy8agGvuziLZ1KkQklhDaghKAeVnGTz44oFpy0NzG3EuSniokHJOQfhXKPHaodIVnlqYq0IS7hH7R5YfuTcotxlZBccHtFXmB7hwDUwgy0pSEoSEIQnCU4xjyHyqJRbIqCy++wtbclw8BHTHgMUom53hhpLxitOfhSoK4PPjRvWcSWzczbpJdT31dpsr8ttoOL7pTaQVcjcOVe4ChXYvAWzaL5cHWyO/bDCFHx4JyP8Ayx8KYTrZe760LYpLYS+oLcW25uIbHJSPT+eKsGwQWbXaGYLI7sbkEjGM+0Cf2pNhC17R2ZxUIfLSfquaI6ENqdCVrBAA64AySPhVVdvVtbvOnIktiQyy7AdwhtS8LcSrrjzOeSPCm1yha/m6wVeIcBAjtMqjRmXXAUJQrqo+p6/AUZtOg5Ds5F41pcUTXI/ttxknDLePFVSoi1MHzLhuddpks7ELQ/b9HMM3RsKeWkrSlwchtR9kH9fnVY6evX/wu7TLjZZGfqwSVR3EHoY61bmyfdkH4nzq5NOagj3N55cfPdbQErxhKwD+H09fGqV7foGNbR5zatplwCo4/M2cZ/8AEp+Ve0z+W1q294V1Wxdyz0s082y2EtFAaxlISOOfKqG/6jLAw/Ig3vb7TDiGX1ebS+Mn3H96OdnXaBKumj4neKjKcjj6OovOkE7ehx7sUK7XL2xcbC7FdW2pb8TBwcgKByMH30nTq9V+J6zY9WZQcq3raUthYHeNEpUPcSK7jRlyHWUEHYDkeY9KKulMqep1X3nwCfeRz/Jpo08qI+E9AOM+VfQk+wmYVHDS2ezPtMg6Jj3WyXdxTja0KEZAGc7xnb1/vNVUk91BblyUnetxQbbGMADj+KYy0uyZ70kKOUALQfUUYlwVO2ODOThSXRnI6A+I+eaStS1+oTjszdxO1Nrkvhxfj4eVTKMAlpIHgcUDscXa0FEDNG2zsVt8zml3HMr0/HcbupBCsYGaAQp6otycQrorjr60bWv2sVFLolSZaloONpNeABODFWcciOL+53stahzkAfpT/SF++qJEiKpOUygMHPRQoCt/6UMke/n0rcQhuQ2ryUOfKmFMrgxRI7hvVrYejNrGAoK8qibD67ZMafGFbVhXtDI6+VSW/wAwFCW8Zz0OaBuMd9EKgMlBOfWu1H04MS6+8nqb8zLs7ktISXQkpBHUE1Hlx0yNVW+IgjYz3LY46KzuV+tC9OylJHcOct7woj40TsCu+1XHdJ+9IUr964qbNxEYTuAE77QGH5Wv5TRWXXnO6SFYxn2E+FX7aroibpiMge0h6GgDnqCgVS95CV9qsBwkFLmxR94Sf6VPdMTlxbOxFztVGCmDnw2kgfpg/GodWd1aS3Sja7iRxWlrrMu1ju6pESM9b0d04hS/aUASB8xVkWK8yIpkB0bVNscrJyFc0AZcZaUsBtOSST6++oXrq6qYhuNxZDjYcH3W1lOAR/fyoa83uM+0dlaMn5i1+1erVNylLDpMGMS20M/eI6q+fSidg1MzBlLkAIISENJBHlyf79ari0qShCG85ATyBxmuzcC0UtBY4Uon30+/Rh8gxlOs24Ml961VJ1HqMJUv7LcGmm/D1PvJJqdq0BHnR0G3x1RnGkhKFtjrjz86rDsxt7uo+0O0xUAFKFLec8cJSCc/Mj517QjwbRp+3IVLcZZb4G5fHJpbVioBaxiA2qXBLDOTPMlz09erW4UOQw90wpHBJ9QelFXtOxUWxll9grebbxhs7Ss+IyPDNW9qG4aTu7Kkt3KIpRO3buGUnPQ5HB99RyBbIZlmI88klXDSz0X5A89a4NQc7TG01oy7wJAbLbl2x3DmPpHGPHajwSPd+9E57impJIAy4AoccZPl8amty0WXEFTYIUjlKgOQfSq11re4GnJMdM2Swt1oEFDRO8Ec+0nw6nxoGBsPphXhPHiHVXN+K0t1biAlKgOGVKVz4YBqN9ourU2PTxnLZElxxaUojSDsCT5lA649aSXqCFcbalUSSN742NONpIIJSOo8PjVX9qM893Dt65Db7zRU4rC1FbYPRPPhRaendYA0zrb9teR7y1OyXX8vVbEl6XFaZXGQlouN8BXJPTwGMUn2qNpuc+xOZwpTr7JOM+ytvOPmmo92QNi06TW+6oIVMeLgz5AYH7UvrTUsRp+2qWsK7h9Tihn/AOksD9xQlNuqykeLSdMN3cG9j05xtc6AH+6TjvMlKVZPxFIa7uLb9zcZ78KS22Uk46moTar8IEpb3elLagrhvgnPhTKddXpr+5oKSgnoTyo1oHT/AIu+Z5v/AAwsJF/fKaCM8EJ4pZ2MUzkBaVDGFEHy9aaRFORXGlvJJO7dtA5pS5znZ81CFMllCsAq6EinYOeISkGvmdqfEqS862kd2SG046GpS/bV2mx26KrKotwaamsq/I5tw6j54V8TUWedjKkJjw0lLKCMYNTrV85LUWy2zKQWGgCB4EIAP80qwnIEZkEAxtBCQEpSKdP4acGT0TupnajucyegGffS81xP0opUcfZnPpS37jBwMxk6drqgeoOMUKlshx9QPRYolc/s5q/XCh8aZPKG5Cxzg15hxkQDycGRt9tyLJI5Cc0s0Qogiit5gh5ClpBHs54oFHdLDmxzAHmacjbliGBQ/pDF4SHIcd8dU8GmtqKVd6yr8YyPSlVyoztvU0t3CvDFDosoRpLbiiMAYNCFYA8QSVzjM7Daob7g+VPtMukXyKrOClzr8DTi6QRIZTKYVuCk5wOaE2x76PPQ4c+woKPNGp3Icdz2MMJOr3BB1PZ7o0jADvduH1PA/epE053cuRsWFIWQo4PRWMHPwxUakS1zooSngoUlxKEHK1FJCgfQcUQivKQ5tQnIJ5Q17QT6lXiaynztCn2mqqgEn5hKdKLaSvCiFeyQnwqtLvdDc5ajnhIxj+KmGp7u1bbYvf7TjvsNpzznz+FVrEcLilKJyVk4I6GrPp6kKSRI9W3rxH0WSWkkjrTKRIUlwKznqTWLUUNZzjxqS9m2iVa11Mwy/lMBlQL6vzeO0fzV1hCLvaJVXZgi9ybdk82J2cWKRq+5BP0+W2UxGl9SjIA+ZIJ9AKB6j7VtSajuTkx24utFWSG0KIQB4ez0pLtdvC1axdszKEtQrb9gwjbgKScKz7vAegFDLRbYbpSXBuUrrk1KpUDyt7zQr07XP46+AvGY1a1Zdo7DzQkqPfK3L55UffRSzdolwtEuPMSsOFKSlQcJVv5B58j5e+iL+n4TQbcCUcLSeR15pO+adtxSG0sAAElK2zgp99K/qaWIG2aaf6f1QVnWzkS3mO3eO1oV2atJVMUO4bQk+0lzHU58uuao9ux3DUzcq6PrW4pSi77X/c8TzQB2M5HlBkr3JV4njNTi0X1FuiIjD2WkJ4z1obfwUxSOTD+k6JNTcx1PpAH9zBVnlL07MwyshpzAcSeh/wBXv6UO1PZI9xuEmSZb6pJISGiM7Tnz8R5UxvF2Di3W2B7KVrx6J3dPlU2tEKKtli4rQSruxsKup4FGWNeHPZmPr662s2V9CR2532VZ4EeIhpbbaEbUeFQ+bcJFxX9oorPlmpBrm5JlytgIIQMD0oBaI/ePhas7OpPkKppUbd5HMzLmO7YDxFo0JLJwoe0elHLRa++cCygDByMikoMX6S4XVD2Tyn3VKoDASEJRgDrnyFKvuI4EZXVnkxjevo8WS0HFBCWI2SSR95RwP05qJ3O4KuEnczuSjG3J/ejV8nR31vLSgSHZDoIAGQlCRgZPhzTC12Q3EKly190wDjanqqm1nau5pxySNonNjbCpjS8fZII5/MRRO63BVyvJO4qKOhodMlIEtLcZIS2g7UhPlRCKw1EkJ79YS6sjCMZVzRNg+qApOcSUWRH+H3Hr0pO9LQ3EeV+NatgPkKdxEpjtlBUBgBXNR7UMzd3TO4ZHtnHrSAMmWscCEb+nDjT/AIKTj444oSVApwelGbkPptjbfRypAC/lwaj/AHnHNdXrBgscGF2gmTEAOM/dOKil6tT6ZOSpIbJ4x1qU2ZKnU7fwLG3PkrwpK8w9zRUohO3qT0pNRNb/AKQrVDpmRNhDDC8yUlSfIHrSUlTf0hxKfabVyn/TSr7iHd7iOUIOAfzU3JDnGzHrWmmfmZTgZ6jq23R+27m0ErYX95B/iiku0KbdElpWULSDtxng0DGEjkZHlUq0/d2Vxm4byh3iRhBP4h5e+pbwazvSVaZg/oeNrbdFN/YPZCc7V4O0rT5E1KokoyUBuK4lCE/eKE4A9M+dALlYBJWp2Odquv8AuPlQ6Jc5VnX3LgOAeRUboLfUvcvDGrhuoT7QWSqNEUCVDcoc+4frUMZXs7hX5QePGpqu+x7ooRnmUrZI9rNNFaRhvSMtzFJZAyE49oemafp7fGuxxzEXr5G3pI2kfS3G0JWlO87eTjFXRoqRC0zp4z4iTsjtKWpSTypQ659eKpm6sRYa0xI4KzytSyr14pzB1LIj6bl2TJU2+4FA5xt8x8adbX5VyJ7S3+FzG9/u0i+3qTdXye9kK3H0HQD5AUnFuj8VQwtQpu3nGOoHnS6WQoeFEQMbccRis4JYHuFf/VMlTaEbyfaB594p9N1M9IVtxjJ6g1HPo4QoKISQDmn7cFUyN3iCEgA9PT1pD1JwQJr6XXaghlB7nTr6lyS4SHSRgn8KTWTJLaGUrRJUVK4KT4UnEA7gIBCfMUykKCW1NnBCFHBokXJiLNQ1dZOe4Y0pZWriVXCU4FsMrI7vP31gZ+XIo1qHUqGWChlYB6ADwqKRLouFGcbbwkLOcDzpsll+crISpXvomq9eWPEwzbkYXuIKS9dJhwFFSvLpR562otjDbSlEPPDcVY491HtP2NqEwl91H2hGcHwoHfJxlXctpVlCDtHoKDzFm2r0J3xbF3N2Y/t7qEKQlWQFfdwKdPu94sw21ErXhThB+4jP70iypYjhuK2pTih1VwEDzpVDKILPdNq7x1Z3OL8SaU6jdzHjgYjae0H1htACUpG0bRjAri4S0RmBGaG0YwmnG08+ZoNfHcvNoTg914imI247Ymw4GYlFaQw62857QbO7nxxzRmCpqK+5dLgdzijvWepGeiR+lBO8CkpAPXrTwzUPysyGyWU8934KOP2qooZPvAOYZTcbld0PPjbAi7M5A3OLRnzoDKeLzyjuyBx76cXCROlsh6Q73SFcIbTwNvl7qGsqQlO1IxjxoNuI7cTJppuUmXDcjKOduePMUDfbVGkuMLH3CR76aacvAgzEKJwgjar1zRjUZZVIblNqBSsYXjz8KXtIfEbvBQGd2Kalib3S1ew9gD0UKL3OO1JZU24nLZHPPWoYp4ghbZwpJCgfUcipfGmfWlqDiAN6eFDyPiKB1jEcEYkT1E0xCRFYZbCeCMJ8fWg7alFIO3jJBPlUmXF+mXNuU+UlqMnCUDqo+tNrlZRHZU4xlxCllW73806u0AbTJbKSWyIE3YNaDuxW4dfDFPokSPKBaXubcTzuH4hTadb3oSgdpcbP4h4U4Wg8RBqI5hi2alcDCmZS960coXjBIrpU6Fcld3IJSpXG4cVHEjAyE5/pRBi0mUwZEdW/H3k+Kals0yKSw95VVq3YbCM4jidZ5EEpU0o7T91ZPFMHLnNjqKFqJ88HpTxmdKhKShwhxI/CoZGK5mIizkLWyotqCStQV6eFdQknDczjqBypxAkiSZD3e7QlWAOK2w+EbyoAqXwePCkdwPTgdaxPCqqxgYk5bMdskcDGAOlOgMjjrTJK8cmuxNCBnqaHbLVsAHJjslaE8mlolySyhTbjyQDyEmhTk9x4+zwPLFaYiKkvIB4z1rjICOYVeqYOPFHq5yEpWlOCQeopg68VA89VU4fhfR3Vt+6m7zXdnCvOvIF9pzUPYVw3tHVujfS5CG89c1PbLaGorCVqQVK8eKgsVZiOpea25TyAfH0o+nWoejBhxvuHR+U5B91T6pHbhYvTsqct3JDdZa0MKZjpG5QwVq9lI/8AccCoo3ZZSHy88pgIJzkLyaQfvjyF5CGlK8FrTuUPdmurZcpE2RiQ6XB5ECvVV+NYVtqueYfafDTPdtN4GclfnWDqVeJre/I5rhaw0jepWB1xU7Nk8QjEpcoR2isH2jwB6+dAllLmQvnNKzZBffKs5HgKyHG75RcV9xsZVnxNUVrtES3MZJQWlAbsn3U6BKgCeSOlcvuBbpPh1pVpOU7j0FWZ4kWCWwInNkPPIbbWrIQNvwpJhslQSkZzWLXvWc880vb0hTpWfup6e+kk5lSr8wY8lTS8IORTxMtx5pCVuHIHjTd5WEZHXzpv3uDkk0xYluOI+L5T48UTsN6+rZh3K+ycwFDwFBVIcTHEjGWydoNIF7HQ4rzoCMT1dhQ5k7vLJjuiXHOWlnkD8NNBKMdKX2juaV1QecGmNl1EyqP9XXBe1B4Q4fD0NduFVtkd2VbmV87uoUP61I1UsFoIzFJ9uRJR9NhjYsHcpApKLLblsrQ7wroUn8VJ/TTAeUthRW0o8jNMrk7HWsSozu1ZOcV4KTxBZwI2fb+jurbB4B491ajzHYjocaWUkeHgffSbstL6QTkLHHwpspzPjVYUFcNI8lWyslcWTEuaTgYfIyU+fuoRdYC4qFvqUUj7u3zoSiQ40sLbWUqHQ5rt2XKlpDbilrGeBnNKWrae+I827h1zERgCu2k714p6za1JGXQSs/hHOKVft5jth1IGc9BRmxc4lCaGzbvMYKju88nFY3DJPtHmnbchClbFJKPU0uW0kZbwT4ZrxaeWkE/rG6YyWxnApaPnv0bf/wCUZb0289GDhktJUoZ2FJ4+P/FNfoDttCytrvMj/MbORilG1TxNKvQWphyuBGUtf2yvxHjnyobMcJV1zzT8JCiSVdaHzmtrg2nPpXa8Zk+uB2kxeGslBCjknpXEhB3FY9xpWDDlP57lh1Y80oJA+PhSq29wWkjBHUeRp4YZ4MzXqYgFgRGJXuRkkk0/sqw29k9aHqT3Y56UrFd7p3k1ywZWJT0nmTYKQlO5ZwnzoPPmh9woBwgU3k3JchtCRnu/TrSTTbjy+7bSFKUfHwqRatvqaWFs9TuOw5JcDTY5J6+Qp1NktspEWOcpSfbPma6lrRaIqUIUVPujG4dRQYvYyomnoMnJ6ibGwMRVJ7xwp8zTl1wpQEoOB0P9abREnBX4+Brpat6uPDiiY8wa1xyZz4+pp/GHdN46Z5pm23uUPTmnPeZ+FBGrBUt0BzA4CeopstWOnFdEFH3uffXHrTwMSRjk5irC5amy2hxQbV1BAxXX0TPCl7vdSCnV4rkOKHifnXcTm6KraSk4JrANo9hR8wM0mHM9a2lWTgAk+lc+86AT+WLiW4kFJyc9QfGk1BKlZHNbEaQ70QoDzIpw1a3l4B9kedDuURootboRrtOcVpSFAcc0SctyI5AK8qPrSrELadywNtc8o9o0aOzowMGlOEDbk+VFYbKY+Ccd54nypZ6MndvRx7qbJXsXg0p2yOJXpqBW2WhiKoZx0HUkVt4JdyflTEPAJ2tnr1pyh3eEtoHtfm8qmZZv12qRiDpcRS18j14603Sp9lQSg5AOaPKQkkNJ5WoYLlNZcZtoBCBk+KvWmLZxgya7SLncIftExLjJSop3+WaTmjAUeAT1xUNLLxfKW3FFWfwkin30a4xk53upSfBS80tqADkGV1/VndNhr4HGcxSShtToCeFFWD5V1BhpXJBW2HCD49B8KZPlxtSe9ACiN3XnFcIkzSMNeyfTr76aEO3gyB9VUH9QzJ6w4EMhKRtAGABwBUSu7aGZbikH7/UDzpkuTc8Eh54gfewrxpJKJLoLil957+a5TUUbOYf1L6gNTV4ghGJw6nPWuBjOcCidvjMrO907/Q8V1dYDDZR9ESSs/eCeRVm8Z5nzb0N3B6HCcBJ2++iDMkwW9+w7iMc+P/FDlQ5Xgy5n3Uq6p5YQHioFIxS3AY4zxPKrqMkTH5Dsl1Tq15J6gmkVEHg9K2eKTUcnFNA4xFE5j1LyEJSkHGa2diE8qPPlTZCOM04VwkGh2ww/GJn00NDhBPhmttyELVkEpPr0ps6cim+7Cq7sEHyEdTSq4Uayso4ucKNc1lZXp4dwrEtjS20uLUVZ8KdBtDKdiEAVlZUbsczcprUJ1Ng80uhZQNwrKygMqTibU4p9QzxinGS2lPOcnFZWUM4nJMT2BLy2vw0xuTSW8BPrWVlEvc5cBtzGjLhRwOh4ozHQA0EJ4J5zWVlefqM0PPcW3YRgDpTOU4pLSiPE4rKygXuXWkgRzEjtxk5QPaA3ZrTY75XeLJKirn3c8VlZQnuGwC18fEDoWZDzri+qsj3UgXFNLSUnBHjWVlXe0+ZckNkSQRUJfjNOqHKhzQ6c2Ib6S3kBXUVlZUqn1GblvNIY9zqKd7tP1oA5FZWUZ7kNYBXJnDcl1Q+0Vv8AfWEtr9ktJ54rKygJ5lSAEcxGTbo4TnYefWmLkJDaStCiAPA81lZTq2JkWsqQDgRuo4rYPFZWVTMCJL60maysrwnp/9k=', 'rejected', NULL, '2026-03-11 23:10:32', '2026-03-11 23:09:57', '2026-03-11 23:10:32');
INSERT INTO `profile_update_requests` (`id`, `user_id`, `reviewed_by`, `name`, `email`, `company`, `address`, `mobile_number`, `profile_photo_url`, `status`, `admin_notes`, `reviewed_at`, `created_at`, `updated_at`) VALUES
(3, 1, 2, 'John Doe', 'customer@wsiportal.com', 'WSI Demo Client', 'Davao City, Davao del Sur, Philippines', '+63 912 345 6789', 'data:image/jpeg;base64,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', 'approved', NULL, '2026-03-12 18:58:31', '2026-03-12 18:57:59', '2026-03-12 18:58:31');

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` bigint UNSIGNED NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `billing_cycle` enum('monthly','yearly','one_time') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `slug`, `category`, `name`, `description`, `price`, `billing_cycle`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'domains-top-level-domains', 'Domains', 'Top Level Domains', 'WSI managed service offering for Top Level Domains.', 1440.00, 'yearly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(2, 'domains-country-level-domains', 'Domains', 'Country Level Domains', 'WSI managed service offering for Country Level Domains.', 2880.00, 'yearly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(3, 'domains-hybrid-top-level-domains', 'Domains', 'Hybrid Top Level Domains', 'WSI managed service offering for Hybrid Top Level Domains.', 3360.00, 'yearly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(4, 'domains-education-domains', 'Domains', 'Education Domains', 'WSI managed service offering for Education Domains.', 4420.00, 'yearly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(5, 'domains-government-domains-one-time-registration', 'Domains', 'Government Domains (one-time registration)', 'WSI managed service offering for Government Domains (one-time registration).', 4320.00, 'one_time', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(6, 'shared-hosting-starter', 'Shared Hosting', 'Starter', 'WSI managed service offering for Starter.', 4080.00, 'monthly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(7, 'shared-hosting-standard', 'Shared Hosting', 'Standard', 'WSI managed service offering for Standard.', 8520.00, 'monthly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(8, 'shared-hosting-deluxe', 'Shared Hosting', 'Deluxe', 'WSI managed service offering for Deluxe.', 15000.00, 'monthly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(9, 'shared-hosting-business', 'Shared Hosting', 'Business', 'WSI managed service offering for Business.', 24120.00, 'monthly', 1, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(10, 'dedicated-server-dedicated-essential', 'Dedicated Server', 'Dedicated_Essential', 'WSI managed service offering for Dedicated_Essential.', 33600.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(11, 'dedicated-server-dedicated-business', 'Dedicated Server', 'Dedicated_Business', 'WSI managed service offering for Dedicated_Business.', 64800.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(12, 'dedicated-server-dedicated-premium', 'Dedicated Server', 'Dedicated_Premium', 'WSI managed service offering for Dedicated_Premium.', 100680.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(13, 'dedicated-server-dedicated-professional', 'Dedicated Server', 'Dedicated_Professional', 'WSI managed service offering for Dedicated_Professional.', 181800.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(14, 'dedicated-server-dedicated-corporate', 'Dedicated Server', 'Dedicated_Corporate', 'WSI managed service offering for Dedicated_Corporate.', 280200.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(15, 'dedicated-server-dedicated-enterprise', 'Dedicated Server', 'Dedicated_Enterprise', 'WSI managed service offering for Dedicated_Enterprise.', 529200.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(16, 'dedicated-server-dedicated-baremetal-linux', 'Dedicated Server', 'Dedicated BareMetal_Linux', 'WSI managed service offering for Dedicated BareMetal_Linux.', 200520.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(17, 'dedicated-server-dedicated-baremetal-windows', 'Dedicated Server', 'Dedicated BareMetal_Windows', 'WSI managed service offering for Dedicated BareMetal_Windows.', 224160.00, 'monthly', 1, '2026-03-10 21:58:53', '2026-03-10 21:58:53');

-- --------------------------------------------------------

--
-- Table structure for table `service_addons`
--

CREATE TABLE `service_addons` (
  `id` bigint UNSIGNED NOT NULL,
  `service_id` bigint UNSIGNED NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extra_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `service_addons`
--

INSERT INTO `service_addons` (`id`, `service_id`, `label`, `extra_price`, `created_at`, `updated_at`) VALUES
(1, 1, 'WhoIs', 780.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(2, 1, 'Secure Socket Layer (Wildcard SSL)', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(3, 1, 'Secure Socket Layer (Standard SSL)', 10800.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(4, 2, 'WhoIs', 780.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(5, 2, 'Secure Socket Layer (Wildcard SSL)', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(6, 2, 'Secure Socket Layer (Standard SSL)', 10800.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(7, 3, 'WhoIs', 780.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(8, 3, 'Secure Socket Layer (Wildcard SSL)', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(9, 3, 'Secure Socket Layer (Standard SSL)', 10800.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(10, 4, 'WhoIs', 780.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(11, 4, 'Secure Socket Layer (Wildcard SSL)', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(12, 4, 'Secure Socket Layer (Standard SSL)', 10800.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(13, 5, 'WhoIs', 780.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(14, 5, 'Secure Socket Layer (Wildcard SSL)', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(15, 5, 'Secure Socket Layer (Standard SSL)', 10800.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(16, 6, 'Static IP', 3000.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(17, 6, 'SiteLock', 14160.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(18, 6, 'Codeguard', 6720.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(19, 6, 'Magic Spam PRO', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(20, 6, 'Imunify360', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(21, 6, 'Additional 1 GB Storage', 3120.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(22, 6, 'Additional 10 GB Data Cap', 3120.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(23, 6, 'MS SQL Database for Windows', 3720.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(24, 7, 'Static IP', 3000.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(25, 7, 'SiteLock', 14160.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(26, 7, 'Codeguard', 6720.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(27, 7, 'Magic Spam PRO', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(28, 7, 'Imunify360', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(29, 7, 'Additional 1 GB Storage', 3120.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(30, 7, 'Additional 10 GB Data Cap', 3120.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(31, 7, 'MS SQL Database for Windows', 3720.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(32, 8, 'Static IP', 3000.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(33, 8, 'SiteLock', 14160.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(34, 8, 'Codeguard', 6720.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(35, 8, 'Magic Spam PRO', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(36, 8, 'Imunify360', 23400.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(37, 8, 'Additional 1 GB Storage', 3120.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(38, 8, 'Additional 10 GB Data Cap', 3120.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(39, 8, 'MS SQL Database for Windows', 3720.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(40, 9, 'Static IP', 3000.00, '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(41, 9, 'SiteLock', 14160.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(42, 9, 'Codeguard', 6720.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(43, 9, 'Magic Spam PRO', 23400.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(44, 9, 'Imunify360', 23400.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(45, 9, 'Additional 1 GB Storage', 3120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(46, 9, 'Additional 10 GB Data Cap', 3120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(47, 9, 'MS SQL Database for Windows', 3720.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(48, 10, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(49, 10, 'Bare Metal Control Panel for Linux (cPanel)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(50, 10, 'Bare Metal Control Panel for Windows (Parallel Plesk)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(51, 10, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(52, 10, 'Bare Metal MS SQL 2012/2016 Web Edition', 81120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(53, 10, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(54, 11, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(55, 11, 'Bare Metal Control Panel for Linux (cPanel)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(56, 11, 'Bare Metal Control Panel for Windows (Parallel Plesk)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(57, 11, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(58, 11, 'Bare Metal MS SQL 2012/2016 Web Edition', 81120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(59, 11, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(60, 12, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(61, 12, 'Bare Metal Control Panel for Linux (cPanel)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(62, 12, 'Bare Metal Control Panel for Windows (Parallel Plesk)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(63, 12, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(64, 12, 'Bare Metal MS SQL 2012/2016 Web Edition', 81120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(65, 12, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(66, 13, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(67, 13, 'Bare Metal Control Panel for Linux (cPanel)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(68, 13, 'Bare Metal Control Panel for Windows (Parallel Plesk)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(69, 13, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(70, 13, 'Bare Metal MS SQL 2012/2016 Web Edition', 81120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(71, 13, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(72, 14, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(73, 14, 'Bare Metal Control Panel for Linux (cPanel)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(74, 14, 'Bare Metal Control Panel for Windows (Parallel Plesk)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(75, 14, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(76, 14, 'Bare Metal MS SQL 2012/2016 Web Edition', 81120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(77, 14, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(78, 15, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(79, 15, 'Bare Metal Control Panel for Linux (cPanel)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(80, 15, 'Bare Metal Control Panel for Windows (Parallel Plesk)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(81, 15, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(82, 15, 'Bare Metal MS SQL 2012/2016 Web Edition', 81120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(83, 15, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(84, 16, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(85, 16, 'Bare Metal Control Panel for Linux (cPanel)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(86, 16, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(87, 16, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(88, 17, 'Daily Back-Up with Retention of 3 Back-ups up to 150 GB', 27360.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(89, 17, 'Bare Metal Control Panel for Windows (Parallel Plesk)', 78000.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(90, 17, 'Bare Metal Daily Back-Up with Retention of 3 Back-ups up to 1.5 TB', 42960.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(91, 17, 'Bare Metal MS SQL 2012/2016 Web Edition', 81120.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(92, 17, 'Bare Metal Gigabit LAN', 43680.00, '2026-03-10 21:58:53', '2026-03-10 21:58:53');

-- --------------------------------------------------------

--
-- Table structure for table `service_configurations`
--

CREATE TABLE `service_configurations` (
  `id` bigint UNSIGNED NOT NULL,
  `service_id` bigint UNSIGNED NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `service_configurations`
--

INSERT INTO `service_configurations` (`id`, `service_id`, `label`, `created_at`, `updated_at`) VALUES
(1, 1, 'Top Level Domains', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(2, 2, 'Country Level Domains', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(3, 3, 'Hybrid Top Level Domains', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(4, 4, 'Education Domains', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(5, 5, 'Government Domains (one-time registration)', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(6, 6, 'Starter', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(7, 7, 'Standard', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(8, 8, 'Deluxe', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(9, 9, 'Business', '2026-03-10 21:58:52', '2026-03-10 21:58:52'),
(10, 10, 'Dedicated_Essential', '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(11, 11, 'Dedicated_Business', '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(12, 12, 'Dedicated_Premium', '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(13, 13, 'Dedicated_Professional', '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(14, 14, 'Dedicated_Corporate', '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(15, 15, 'Dedicated_Enterprise', '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(16, 16, 'Dedicated BareMetal_Linux', '2026-03-10 21:58:53', '2026-03-10 21:58:53'),
(17, 17, 'Dedicated BareMetal_Windows', '2026-03-10 21:58:53', '2026-03-10 21:58:53');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`) VALUES
('g5HcZ0EkfYeTkBiUKBVDOwb3alr9HaPaH6Gsp1fU', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoia3JCVnlzM0c4N1dzdWxyaWhlb25yVUU3NGF4STE4OUpzaEdqeHE0UiI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1773118392),
('wRjLq1jFSX7QxygEX5zn1Lp1Rmo2vEEgNvB2ryho', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiWVNjb2tranpSNXQ2dEFnQmU1UGxzbGZnWEdQNVhKSURCZmF5bHJpcSI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1773118244);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_number` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tin` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_photo_url` longtext COLLATE utf8mb4_unicode_ci,
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `role` enum('customer','admin','technical_support','sales') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `registration_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `registration_admin_notes` text COLLATE utf8mb4_unicode_ci,
  `registration_reviewed_by` bigint UNSIGNED DEFAULT NULL,
  `registration_reviewed_at` timestamp NULL DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `company`, `address`, `mobile_number`, `tin`, `profile_photo_url`, `two_factor_enabled`, `role`, `is_enabled`, `registration_status`, `registration_admin_notes`, `registration_reviewed_by`, `registration_reviewed_at`, `email_verified_at`, `password`, `remember_token`, `created_at`, `updated_at`) VALUES
(1, 'John Doe', 'customer@wsiportal.com', 'WSI Demo Client', 'Davao City, Davao del Sur, Philippines', '+63 912 345 6789', NULL, 'data:image/jpeg;base64,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', 1, 'customer', 1, 'approved', NULL, NULL, NULL, NULL, '$2y$12$ljD6c.NiXFLnRLR0862P5eHEtmoWzTve8cBfBrtVt7z49BBcfZBKa', NULL, '2026-03-10 21:58:51', '2026-03-12 18:58:31'),
(2, 'Administrators', 'admin@wsiportal.com', 'WSI', 'Makati City, Metro Manila, Philippines', '+63 917 555 0101', NULL, 'https://ui-avatars.com/api/?name=Administrators&background=0f172a&color=fb923c&size=256', 0, 'admin', 1, 'approved', NULL, NULL, NULL, NULL, '$2y$12$ZfEkx7boZuCykNK2v1mi.uQjiOmGyewnTf8CpgOMpialWSz7gVX1i', NULL, '2026-03-10 21:58:51', '2026-03-11 00:12:15');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_expiration_index` (`expiration`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_locks_expiration_index` (`expiration`);

--
-- Indexes for table `customer_services`
--
ALTER TABLE `customer_services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customer_services_order_item_id_unique` (`order_item_id`),
  ADD KEY `customer_services_user_id_foreign` (`user_id`),
  ADD KEY `customer_services_service_id_foreign` (`service_id`),
  ADD KEY `customer_services_cancellation_reviewed_by_foreign` (`cancellation_reviewed_by`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_items_portal_order_id_foreign` (`portal_order_id`),
  ADD KEY `order_items_service_id_foreign` (`service_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `payments_portal_order_id_foreign` (`portal_order_id`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  ADD KEY `personal_access_tokens_expires_at_index` (`expires_at`);

--
-- Indexes for table `portal_notifications`
--
ALTER TABLE `portal_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `portal_notifications_user_id_foreign` (`user_id`);

--
-- Indexes for table `portal_orders`
--
ALTER TABLE `portal_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `portal_orders_order_number_unique` (`order_number`),
  ADD KEY `portal_orders_user_id_foreign` (`user_id`);

--
-- Indexes for table `profile_update_requests`
--
ALTER TABLE `profile_update_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `profile_update_requests_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `profile_update_requests_user_id_status_index` (`user_id`,`status`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `services_slug_unique` (`slug`);

--
-- Indexes for table `service_addons`
--
ALTER TABLE `service_addons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `service_addons_service_id_foreign` (`service_id`);

--
-- Indexes for table `service_configurations`
--
ALTER TABLE `service_configurations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `service_configurations_service_id_foreign` (`service_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`),
  ADD KEY `users_registration_reviewed_by_foreign` (`registration_reviewed_by`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `customer_services`
--
ALTER TABLE `customer_services`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=146;

--
-- AUTO_INCREMENT for table `portal_notifications`
--
ALTER TABLE `portal_notifications`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=340;

--
-- AUTO_INCREMENT for table `portal_orders`
--
ALTER TABLE `portal_orders`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT for table `profile_update_requests`
--
ALTER TABLE `profile_update_requests`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `service_addons`
--
ALTER TABLE `service_addons`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=93;

--
-- AUTO_INCREMENT for table `service_configurations`
--
ALTER TABLE `service_configurations`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `customer_services`
--
ALTER TABLE `customer_services`
  ADD CONSTRAINT `customer_services_cancellation_reviewed_by_foreign` FOREIGN KEY (`cancellation_reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_services_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_services_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `customer_services_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_portal_order_id_foreign` FOREIGN KEY (`portal_order_id`) REFERENCES `portal_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_items_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE RESTRICT;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_portal_order_id_foreign` FOREIGN KEY (`portal_order_id`) REFERENCES `portal_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `portal_notifications`
--
ALTER TABLE `portal_notifications`
  ADD CONSTRAINT `portal_notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `portal_orders`
--
ALTER TABLE `portal_orders`
  ADD CONSTRAINT `portal_orders_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `profile_update_requests`
--
ALTER TABLE `profile_update_requests`
  ADD CONSTRAINT `profile_update_requests_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `profile_update_requests_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `service_addons`
--
ALTER TABLE `service_addons`
  ADD CONSTRAINT `service_addons_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `service_configurations`
--
ALTER TABLE `service_configurations`
  ADD CONSTRAINT `service_configurations_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_registration_reviewed_by_foreign` FOREIGN KEY (`registration_reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
